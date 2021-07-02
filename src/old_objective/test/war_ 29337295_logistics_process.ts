import { CreepTask } from "game_object_task/creep_task"
import { MoveToPortalTask } from "game_object_task/creep_task/move_to_position_task"
import { BoostAllTask } from "game_object_task/creep_task/multi_task/boost_all_task"
import { MoveResourceTask } from "game_object_task/creep_task/multi_task/move_resource_task"
import { SequentialTask } from "game_object_task/creep_task/multi_task/sequential_task"
import { TransferTask } from "game_object_task/creep_task/transfer_task"
import { InterShardCreepDelivererObjective } from "old_objective/creep_provider/inter_shard_creep_deliverer_objective"
import { CreepProviderPriority, SingleCreepProviderObjective } from "old_objective/creep_provider/single_creep_provider_objective"
import { decodeObjectiveFrom, Objective, ObjectiveState } from "old_objective/objective"
import { Procedural } from "old_objective/procedural"
import { Process, processLog, ProcessState } from "process/process"
import { spawnPriorityLow } from "old_objective/spawn/spawn_creep_objective"
import { MessageObserver } from "os/infrastructure/message_observer"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { CreepName } from "prototype/creep"
import { roomLink } from "utility/log"
import { generateCodename, generateUniqueId } from "utility/unique_id"

const destinationShardName = "shard3"
const spawnRoomName = "W51S29"
const portalRoomName = "W50S30"
const portalId = "5c0e406c504e0a34e3d61db1" as Id<StructurePortal>
const labInfo: { [index: string]: {resource: MineralCompoundConstant, part: BodyPartConstant}} = {
  "5b3b46b6db891733a68763db": {resource: RESOURCE_CATALYZED_GHODIUM_ALKALIDE, part: TOUGH},
  "5b3b3f3b58a02e70ebaa0add": {resource: RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE, part: MOVE},
  "5b2552233deea0034025a183": {resource: RESOURCE_CATALYZED_KEANIUM_ALKALIDE, part: RANGED_ATTACK},
  "5b258a00a84f8b52880bff57": {resource: RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE, part: HEAL},
}

type War29337295LogisticsProcessCreepType = "heavy_attacker" | "heavy_dismantler"

export interface War29337295LogisticsProcessState extends ProcessState {
  /** child objective states */
  s: ObjectiveState[]

  /** creeps */
  cr: {
    /** lab charger name */
    l: CreepName | null

    /** ranged attacker names */
    ra: CreepName[]
  }
}

// Game.io("launch War29337295LogisticsProcess -l")
export class War29337295LogisticsProcess implements Process, Procedural, MessageObserver {
  private readonly codename = generateCodename(this.constructor.name, this.launchTime)
  private shouldSpawnRangedAttacker = false
  private get creepProviders(): SingleCreepProviderObjective[] {
    return this.objectives.filter(objective => objective instanceof SingleCreepProviderObjective) as SingleCreepProviderObjective[]
  }

  public constructor(
    public readonly launchTime: number,
    public readonly processId: number,
    private readonly objectives: Objective[],
    private labChargerName: CreepName | null,
    private rangedAttackerNames: CreepName[],
  ) { }

  public encode(): War29337295LogisticsProcessState {
    return {
      t: "War29337295LogisticsProcess",
      l: this.launchTime,
      i: this.processId,
      s: this.objectives.map(objective => objective.encode()),
      cr: {
        l: this.labChargerName,
        ra: this.rangedAttackerNames,
      },
    }
  }

  public static decode(state: War29337295LogisticsProcessState): War29337295LogisticsProcess {
    const objectives = state.s.reduce((result: Objective[], current: ObjectiveState): Objective[] => {
      const objective = decodeObjectiveFrom(current)
      if (objective != null) {
        result.push(objective)
      }
      return result
    }, [] as Objective[])
    return new War29337295LogisticsProcess(state.l, state.i, objectives, state.cr.l, state.cr.ra ?? [])
  }

  public didReceiveMessage(message: string): string {
    switch (message) {
    case "ranged_attacker": {
      const labs = this.getLabs()
      if (this.isLabsReady(labs) !== true) {
        return "labs not ready"
      }
      this.shouldSpawnRangedAttacker = true
      return "ok"
    }
    case "dismantler":
      this.addCreep("heavy_dismantler")
      return "ok"
    default:
      return `Invalid creep type, specify one of [ranged_attacker, dismantler] (${message})`
    }
  }

  public runOnTick(): void {
    this.runObjectives()
    const labs = this.getLabs()
    this.runLabs(labs)

    const time = Game.time
    if (time % 631 === 0) {
      this.addCreep("heavy_attacker")
    }

    if (this.shouldSpawnRangedAttacker === true) {
      this.shouldSpawnRangedAttacker = false
      this.spawnRangedAttacker()
    }

    this.runRangedAttackers(labs)
  }

  // ---- Ranged Attacker ---- //
  private runRangedAttackers(labs: StructureLab[]): void {
    const spawningCreepNames = this.creepProviders.map(objective => objective.creepName)
    const deadCreepNames: CreepName[] = []
    const rangedAttackers: Creep[] = []
    this.rangedAttackerNames.forEach(name => {
      const creep = Game.creeps[name]
      if (creep != null) {
        rangedAttackers.push(creep)
        return
      }
      if (spawningCreepNames.includes(name) === true) {
        return
      }
      deadCreepNames.push(name)
    })
    this.rangedAttackerNames = this.rangedAttackerNames.filter(name => deadCreepNames.includes(name) !== true)

    rangedAttackers.forEach(creep => this.runRangedAttacker(creep, labs))
  }

  private runRangedAttacker(creep: Creep, labs: StructureLab[]): void {
    if (creep.spawning === true) {
      return
    }

    if (creep.task == null) {
      const portal = Game.getObjectById(portalId)
      if (portal == null) {
        PrimitiveLogger.fatal(`Portal ${portalId} not found`)
        return
      }

      const time = Game.time
      const childTasks: CreepTask[] = [
        new BoostAllTask(time, labs),
        new MoveToPortalTask(time, portal),
      ]
      creep.task = new SequentialTask(time, childTasks, {i: false})
    }

    const result = creep.task.run(creep)
    switch (result) {
    case "in progress":
      return
    case "finished":
      processLog(this, `Creep ${creep.name} finished its task ${roomLink(creep.room.name)}`)
      return
    case "failed":
      PrimitiveLogger.fatal(`Creep ${creep.name} failed its task ${roomLink(creep.room.name)}`)
      return
    }
  }

  private spawnRangedAttacker(): void {
    for (let i = 0; i < 1; i += 1) {
      const creepName = generateUniqueId(this.codename)
      const body: BodyPartConstant[] = [
        // TOUGH, MOVE, RANGED_ATTACK, MOVE, MOVE, HEAL // for testing
        TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
        MOVE, MOVE, MOVE,
        RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
        RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
        RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
        RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        HEAL, HEAL, HEAL, HEAL, HEAL,
        HEAL, HEAL, HEAL, HEAL,
      ]
      const creepProvider = new SingleCreepProviderObjective(Game.time, [], creepName, {
        spawnRoomName,
        requestingCreepBodyParts: body,
        priority: spawnPriorityLow,
      })
      this.objectives.push(creepProvider)
      this.rangedAttackerNames.push(creepName)
    }
  }

  // ---- Lab ---- //
  private runLabs(labs: StructureLab[]): void {
    const labCharger = ((): Creep | null => {
      if (this.labChargerName == null) {
        return null
      }
      const creep = Game.creeps[this.labChargerName]
      if (creep == null) {
        this.labChargerName = null
        return null
      }
      return creep
    })()

    if (labCharger != null) {
      this.runLabCharger(labCharger, labs)
      return
    }

    const spawningCharger = this.objectives.some(objective => objective instanceof SingleCreepProviderObjective)
    if (spawningCharger !== true) { // FixMe: ranged attacker もSingleCreepProviderObjectiveを使用している
      this.addLabCharger()
    }
  }

  private getLabs(): StructureLab[] {
    const labs: StructureLab[] = []
    for (const labId of Object.keys(labInfo)) {
      const lab = Game.getObjectById(labId)
      if (!(lab instanceof StructureLab)) {
        PrimitiveLogger.fatal(`Lab with ID ${labId} not found (${lab})`)
        return []
      }
      labs.push(lab)
    }
    return labs
  }

  private isLabsReady(labs: StructureLab[]): boolean {
    for (const lab of labs) {
      const info = labInfo[lab.id]
      if (lab.store.getUsedCapacity(RESOURCE_ENERGY) < 1000 || lab.store.getUsedCapacity(info.resource) < 1500) {
        return false
      }
    }
    return true
  }

  private runLabCharger(creep: Creep, labs: StructureLab[]): void {
    if (creep.spawning === true) {
      return
    }
    if (Game.time % 3 === 2) {
      creep.say("lab")
    }

    if (creep.task?.run(creep) === "in progress") {
      return
    }

    if ((creep.ticksToLive ?? 0) < 60 && creep.store.getUsedCapacity() <= 0) {
      creep.suicide()
    }

    this.assignNewTaskFor(creep, labs)

    if (creep.task == null) {
      if (creep.pos.x !== 22, creep.pos.y !== 19) {
        creep.moveTo(22, 19)
      }
    }
  }

  private assignNewTaskFor(creep: Creep, labs: StructureLab[]): void {
    const storedResourceTypes = Object.keys(creep.store) as ResourceConstant[]
    if (storedResourceTypes.includes(RESOURCE_ENERGY) === true) {
      const lab = this.labToChargeEnergy(labs)
      if (lab != null) {
        creep.task = new TransferTask(Game.time, lab, RESOURCE_ENERGY)
        return
      }
    }
    if (storedResourceTypes[0] != null) {
      const transferTarget = this.getTransferTarget(creep.room)
      if (transferTarget != null) {
        creep.task = new TransferTask(Game.time, transferTarget, storedResourceTypes[0])
        return
      }
      creep.say("err")
      return
    }

    for (const lab of labs) {
      const info = labInfo[lab.id]
      const resourcesInLab = Object.keys(lab.store) as ResourceConstant[]
      const resourceToRemove = resourcesInLab.filter(resource => resource !== info.resource && resource !== RESOURCE_ENERGY)[0]

      if (resourceToRemove != null) {
        // 余分なリソースを退避
        const transferTarget = this.getTransferTarget(creep.room)
        if (transferTarget != null) {
          creep.task = new MoveResourceTask(Game.time, lab, transferTarget, resourceToRemove)
          return
        } else {
          creep.say("err")
        }
      } else {
        // 必要なリソースを投入
        if ((lab.store.getFreeCapacity(info.resource) ?? 0) < 100) {
          continue
        }
        const withdrawTarget = this.structureContainsResource(creep.room, info.resource)
        if (withdrawTarget != null) {
          creep.task = new MoveResourceTask(Game.time, withdrawTarget, lab, info.resource)
        } else {
          creep.say("err")
        }
      }
    }

    // energy投入はworkerがやっているような気がする
  }

  private getTransferTarget(room: Room): StructureStorage | StructureTerminal | null {
    if (room.storage != null && room.storage.store.getFreeCapacity() > 2000) {
      return room.storage
    }
    if (room.terminal != null && room.terminal.store.getFreeCapacity() > 2000) {
      return room.terminal
    }
    return null
  }

  private labToChargeEnergy(labs: StructureLab[]): StructureLab | null {
    const energyNeeded = labs.filter(lab => lab.store.getFreeCapacity(RESOURCE_ENERGY) > 500)
    if (energyNeeded.length <= 0) {
      return null
    }
    return energyNeeded.reduce((lhs, rhs) => lhs.store.getFreeCapacity(RESOURCE_ENERGY) < rhs.store.getFreeCapacity(RESOURCE_ENERGY) ? lhs : rhs)
  }

  private structureContainsResource(room: Room, resource: ResourceConstant): StructureStorage | StructureTerminal | null {
    if (room.storage != null && room.storage.store.getUsedCapacity(resource) > 0) {
      return room.storage
    }
    if (room.terminal != null && room.terminal.store.getUsedCapacity(resource) > 0) {
      return room.terminal
    }
    return null
  }

  private addLabCharger(): void {
    const creepName = generateUniqueId(this.codename)
    const body: BodyPartConstant[] = [
      CARRY, CARRY, MOVE, CARRY, CARRY, MOVE,
      CARRY, CARRY, MOVE, CARRY, CARRY, MOVE,
      CARRY, CARRY, MOVE, CARRY, CARRY, MOVE,
      CARRY, CARRY, MOVE, CARRY, CARRY, MOVE,
      CARRY, CARRY, MOVE,
    ]
    const objective = new SingleCreepProviderObjective(Game.time, [], creepName, {
      spawnRoomName: spawnRoomName,
      requestingCreepBodyParts: body,
      priority: spawnPriorityLow,
    })
    this.objectives.push(objective)
    processLog(this, `Added lab charger ${creepName}`)
  }

  // ---- Run Objectives ---- //
  private runObjectives(): void {
    this.objectives.forEach(objective => {
      if (objective instanceof InterShardCreepDelivererObjective) {
        this.runInterShardCreepDelivererObjective(objective)
        return
      }
      if (objective instanceof SingleCreepProviderObjective) {
        this.runSingleCreepProviderObjective(objective)
        return
      }
    })
  }

  private runInterShardCreepDelivererObjective(objective: InterShardCreepDelivererObjective): void {
    const result = objective.progress()
    switch (result.objectProgressType) {
    case "in progress":
      return
    case "succeeded":
    case "failed":
      this.removeChildObjective(objective)
      return
    }
  }

  private runSingleCreepProviderObjective(objective: SingleCreepProviderObjective): void {
    const result = objective.progress()
    switch (result.objectProgressType) {
    case "in progress":
      return
    case "succeeded":
      if (this.rangedAttackerNames.includes(result.result.name) !== true) {
        this.labChargerName = result.result.name
      }
      this.removeChildObjective(objective)
      return
    case "failed":
      this.removeChildObjective(objective)
      return
    }
  }

  private removeChildObjective(objective: Objective): void {
    const index = this.objectives.indexOf(objective)
    if (index < 0) {
      return
    }
    this.objectives.splice(index, 1)
  }

  // ---- Add Creep ---- //
  private addCreep(creepType: War29337295LogisticsProcessCreepType): void {
    const creepName = generateUniqueId(this.codename)
    const body = this.bodyPatsFor(creepType)
    const priority = this.priorityFor(creepType)
    const objective = new InterShardCreepDelivererObjective(
      Game.time,
      [],
      creepName,
      portalRoomName,
      destinationShardName,
      {
        spawnRoomName,
        requestingCreepBodyParts: body,
        priority,
      }
    )
    this.objectives.push(objective)
    processLog(this, `Added ${creepType} ${creepName}`)
  }

  private priorityFor(creepType: War29337295LogisticsProcessCreepType): CreepProviderPriority {
    switch (creepType) {
    case "heavy_attacker":
      return spawnPriorityLow
    case "heavy_dismantler":
      return spawnPriorityLow
    }
  }

  private bodyPatsFor(creepType: War29337295LogisticsProcessCreepType): BodyPartConstant[] {
    switch (creepType) {
    case "heavy_attacker":
      return [
        TOUGH, TOUGH, TOUGH, TOUGH,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        MOVE, MOVE, MOVE, MOVE,
        ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
        ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
        ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
        ATTACK,
        MOVE,
        HEAL, HEAL, HEAL, HEAL, HEAL,
      ]
    case "heavy_dismantler":
      return [
        WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
        WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
        WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
        WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
        WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
      ]
    }
  }
}
