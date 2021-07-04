import { Procedural } from "old_objective/procedural"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Process, ProcessId, processLog, ProcessState } from "process/process"
import { CreepRole, creepRoleEnergyStore, creepRoleWorker } from "prototype/creep"
import { RoomName } from "prototype/room"
import { EnergyChargeableStructure } from "prototype/room_object"
import { TransferEnergyApiWrapper } from "task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { UpgradeControllerApiWrapper } from "task/creep_task/api_wrapper/upgrade_controller_api_wrapper"
import { MoveHarvestEnergyTask } from "task/creep_task/conbined_task/move_harvest_energy_task"
import { MoveToTargetTask } from "task/creep_task/conbined_task/move_to_target_task"
import { CreepTask } from "task/creep_task/creep_task"
import { roomLink } from "utility/log"
import { creepPoolAssignPriorityLow } from "world_info/resource_pool/creep_resource_pool"
import { spawnPoolSpawnRequestPriorityLow } from "world_info/resource_pool/spawn_resource_pool"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"

export interface LowRCLRoomKeeperProcessState extends ProcessState {
  /** room name */
  r: RoomName
}

/**
 * - creep管理を永続化する必要がないためProblem, TaskRunnerも永続化する必要がない？
 *   - →その場合は毎tick生成する = Problemは自動で解決する
 */
export class LowRCLRoomKeeperProcess implements Process, Procedural {
  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly roomName: RoomName,
  ) {

  }

  public encode(): LowRCLRoomKeeperProcessState {
    return {
      t: "LowRCLRoomKeeperProcess",
      l: this.launchTime,
      i: this.processId,
      r: this.roomName,
    }
  }

  public static decode(state: LowRCLRoomKeeperProcessState): LowRCLRoomKeeperProcess {
    return new LowRCLRoomKeeperProcess(state.l, state.i, state.r)
  }

  public static create(processId: ProcessId, roomName: RoomName): LowRCLRoomKeeperProcess {
    return new LowRCLRoomKeeperProcess(Game.time, processId, roomName)
  }

  public processShortDescription(): string {
    return roomLink(this.roomName)
  }

  public runOnTick(): void {
    const objects = World.rooms.getOwnedRoomObjects(this.roomName)
    if (objects == null) {
      PrimitiveLogger.fatal(`Room ${roomLink(this.roomName)} lost`)
      return
    }

    const objective = new UpgradeControllerObjective(objects)
    const status = objective.currentStatus()
    switch (status.objectiveStatus) {
    case "achieved":
      processLog(this, `Room ${roomLink(this.roomName)} working fine 😀`)
      break
    case "not achieved":
      this.solveProblems(status.problems)
      break
    }

    objective.taskRunners().forEach(taskRunner => taskRunner.run())
  }

  private solveProblems(problems: Problem[]): void {
    const problemSet: Problem[] = []
    problems.forEach(problem => {
      if (problemSet.some(p => p.identifier === problem.identifier) !== true) {
        problemSet.push(problem)
      }
    })

    processLog(this, `Room ${roomLink(this.roomName)} has following problems: ${problemSet.map(p => p.identifier)}`)
    problemSet.forEach(problem => {
      problem.problemSolver.run()
    })
  }
}

// ----

/**
 * - Objective: RCL1 -> RCL2
 *   - lack of worker
 *   - lack of Energy
 *     - need harvesting
 *       - need worker
 *         - need Energy
 */
// Creepは所属を明確にするのではなくリソースプールに共有したらどうか
// 時分割でタスクが変わることをメタタスク内に情報として持てないか

interface Objective {
  currentStatus(): ObjectiveStatus
}

interface TaskRunner {
  run(): void
}

type ProblemSolver = TaskRunner

type ProblemIdentifier = string
interface Problem {
  identifier: ProblemIdentifier
  problemSolver: ProblemSolver  // TODO: 複数のSolverから選択できるようにする: 現在選択中のSolverを保存する必要がある
}

class ObjectiveStatusNotAchieved {
  public readonly objectiveStatus = "not achieved"

  public constructor(public readonly problems: Problem[]) { }
}

class ObjectiveStatusAchieved {
  public readonly objectiveStatus = "achieved"
}

type ObjectiveStatus = ObjectiveStatusAchieved | ObjectiveStatusNotAchieved

class CreepInsufficiencyProblem implements Problem {
  public readonly identifier: ProblemIdentifier
  public problemSolver: CreepInsufficiencyProblemSolver

  public constructor(
    public readonly roomName: RoomName,
    public readonly role: CreepRole,
  ) {
    this.identifier = `${this.constructor.name}_${roomName}_${role}`
    this.problemSolver = new CreepInsufficiencyProblemSolver(roomName, role)
  }
}

class CreepInsufficiencyProblemSolver implements ProblemSolver {
  public constructor(
    public readonly roomName: RoomName,
    public readonly role: CreepRole,
  ) {
  }

  public run(): void {
    World.resourcePools.addSpawnCreepRequest(
      this.roomName,
      {
        priority: spawnPoolSpawnRequestPriorityLow,
        numberOfCreeps: 1,  // TODO:
        body: this.body(),
        roles: [this.role],
        codename: "creep",  // TODO:
      }
    )
  }

  private body(): BodyPartConstant[] { // FixMe: 必要なサイズに
    return [WORK, CARRY, MOVE, MOVE]
  }
}

class EnergyInsufficiencyProblem implements Problem {
  public readonly identifier: ProblemIdentifier
  public readonly problemSolver: CreepInsufficiencyProblemSolver

  public constructor(
    public readonly roomName: RoomName,
  ) {
    this.identifier = `${this.constructor.name}_${roomName}`
    this.problemSolver = new CreepInsufficiencyProblemSolver(roomName, creepRoleEnergyStore)
  }
}

/**
 * - 同じ問題が複数のsituationで発生する、もしくはproblemが循環するなどの事象があるので、problemはまとめておいて同時に解決させる
 *   - →まとめられるproblemをidentifierで判定する
 */
class UpgradeControllerObjective implements Objective {
  public constructor(
    public readonly objects: OwnedRoomObjects,
  ) { }

  public taskRunners(): TaskRunner[] {
    return [
      new OwnedRoomWorkTaskRunner(this.objects),
    ]
  }

  public currentStatus(): ObjectiveStatus {
    const children: Objective[] = [
      new OwnedRoomEnergyAvailableObjective(this.objects),
      new OwnedRoomCreepExistsObjective(this.objects, creepRoleWorker, 8 * this.objects.sources.length),
    ]

    // TODO: この辺はObjective（or ParentObjective）に含めて共通化する
    const problems: Problem[] = children.reduce((result, current) => {
      const status = current.currentStatus()
      switch (status.objectiveStatus) {
      case "achieved":
        break
      case "not achieved":
        result.push(...status.problems)
        break
      }
      return result
    }, [] as Problem[])

    if (problems.length > 0) {
      return new ObjectiveStatusNotAchieved(problems) // 全て集計しないとマージできないため、この段階でproblemの重複チェックはしない
    }
    return new ObjectiveStatusAchieved()
  }
}


class OwnedRoomCreepExistsObjective implements Objective {
  public constructor(
    public readonly objects: OwnedRoomObjects,
    public readonly creepRole: CreepRole,
    public readonly requiredCreeps: number,
  ) { }

  public currentStatus(): ObjectiveStatus {
    const numberOfCreeps = World.resourcePools.checkCreeps(this.objects.controller.room.name, this.creepRole, () => true)
    if (numberOfCreeps > this.requiredCreeps) {
      return new ObjectiveStatusAchieved()
    }
    return new ObjectiveStatusNotAchieved([new CreepInsufficiencyProblem(this.objects.controller.room.name, this.creepRole)])
  }
}

class OwnedRoomEnergyAvailableObjective implements Objective {
  public constructor(
    public readonly objects: OwnedRoomObjects,
  ) { }

  public currentStatus(): ObjectiveStatus {
    const problems: Problem[] = []
    const numberOfEnergyStoreCreeps = World.resourcePools.checkCreeps(this.objects.controller.room.name, creepRoleEnergyStore, () => true)
    if (this.objects.energyStores.length <= 0 && numberOfEnergyStoreCreeps <= 0) {
      problems.push(new EnergyInsufficiencyProblem(this.objects.controller.room.name))
    }
    if (numberOfEnergyStoreCreeps <= 0) {
      problems.push(new CreepInsufficiencyProblem(this.objects.controller.room.name, creepRoleEnergyStore))
    }

    if (problems.length > 0) {
      return new ObjectiveStatusNotAchieved(problems)
    }
    return new ObjectiveStatusAchieved()
  }
}

class OwnedRoomWorkTaskRunner implements TaskRunner {
  public constructor(
    public readonly objects: OwnedRoomObjects,
  ) {}

  public run(): void {
    World.resourcePools.assignTasks(
      this.objects.controller.room.name,
      creepRoleWorker,
      creepPoolAssignPriorityLow,
      (creep: Creep): CreepTask | null => {
        return this.newTaskFor(creep)
      },
      () => true,
    )
  }

  private newTaskFor(creep: Creep): CreepTask | null {
    const noEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) < creep.store.getCapacity() / 2

    if (noEnergy) {
      const source = this.getSourceToAssign(creep.pos)
      if (source == null) {
        return null
      }
      return MoveHarvestEnergyTask.create(source)
    }

    const structureToCharge = this.getStructureToCharge(creep.pos)
    if (structureToCharge != null) {
      return MoveToTargetTask.create(TransferEnergyApiWrapper.create(structureToCharge))
    }

    // const damagedStructure = this.getRepairStructureToAssign()
    // if (damagedStructure != null) {
    //   creep.v4Task = new RepairTask(Game.time, damagedStructure)
    // } else {
    //   const constructionSite = this.getConstructionSiteToAssign(constructionSites)
    //   if (constructionSite != null) {
    //     creep.v4Task = new BuildTask(Game.time, constructionSite)
    //   } else {
    //   }
    // }

    return MoveToTargetTask.create(UpgradeControllerApiWrapper.create(this.objects.controller))
  }

  private getSourceToAssign(position: RoomPosition): Source | null {
    const sources = this.objects.sources
    if (sources.length <= 0) {
      return null
    }
    return sources.reduce((lhs, rhs) => {
      const lTargetedBy = lhs.targetedBy.length
      const rTargetedBy = rhs.targetedBy.length
      if (lTargetedBy === rTargetedBy) {
        return lhs.pos.getRangeTo(position) < rhs.pos.getRangeTo(position) ? lhs : rhs
      }
      return lTargetedBy < rTargetedBy ? lhs : rhs
    })
  }

  private getStructureToCharge(position: RoomPosition): EnergyChargeableStructure | null {
    const chargeableStructures = this.objects.activeStructures.chargeableStructures
    if (chargeableStructures.length <= 0) {
      return null
    }
    return chargeableStructures.reduce((lhs, rhs) => {
      const lTargetedBy = lhs.targetedBy.length
      const rTargetedBy = rhs.targetedBy.length
      if (lTargetedBy === rTargetedBy) {
        return lhs.pos.getRangeTo(position) < rhs.pos.getRangeTo(position) ? lhs : rhs
      }
      return lTargetedBy < rTargetedBy ? lhs : rhs
    })
  }

  // private getConstructionSiteToAssign(constructionSites: ConstructionSite<BuildableStructureConstant>[]): ConstructionSite<BuildableStructureConstant> | null {
  //   const storedConstructionSite = ((): ConstructionSite<BuildableStructureConstant> | null => {
  //     if (this.buildingConstructionSiteId == null) {
  //       return null
  //     }
  //     return Game.getObjectById(this.buildingConstructionSiteId)
  //   })()
  //   if (storedConstructionSite != null) {
  //     return storedConstructionSite
  //   }

  //   const constructionSite = constructionSites[0]
  //   this.buildingConstructionSiteId = constructionSite?.id
  //   return constructionSite
  // }

  // private getRepairStructureToAssign(): AnyStructure | null {
  //   return this.objects.damagedStructures[0] ?? null
  // }
}
