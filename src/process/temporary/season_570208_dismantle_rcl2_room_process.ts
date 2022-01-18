import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { DismantleApiWrapper } from "v5_object_task/creep_task/api_wrapper/dismantle_api_wrapper"
import { SequentialTask, SequentialTaskOptions } from "v5_object_task/creep_task/combined_task/sequential_task"
import { EndlessTask } from "v5_object_task/creep_task/meta_task/endless_task"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { ProcessDecoder } from "process/process_decoder"
import { MessageObserver } from "os/infrastructure/message_observer"

ProcessDecoder.register("Season570208DismantleRcl2RoomProcess", state => {
  return Season570208DismantleRcl2RoomProcess.decode(state as Season570208DismantleRcl2RoomProcessState)
})

export interface Season570208DismantleRcl2RoomProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  /** target structure id */
  ti: Id<AnyStructure> | null

  /** number of creeps */
  n: number

  fleeRange: number
  stopSpawning: boolean
}

export class Season570208DismantleRcl2RoomProcess implements Process, Procedural, MessageObserver {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  private readonly dismantlerRoles: CreepRole[] = [CreepRole.Worker, CreepRole.Mover]
  private readonly dismantlerBody: BodyPartConstant[] = [
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
  ]

  private readonly scoutBody: BodyPartConstant[] = [
    MOVE,
  ]

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private target: AnyStructure | null,
    private numberOfCreeps: number,
    private fleeRange: number,
    private stopSpawning: boolean,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season570208DismantleRcl2RoomProcessState {
    return {
      t: "Season570208DismantleRcl2RoomProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      ti: this.target?.id ?? null,
      n: this.numberOfCreeps,
      fleeRange: this.fleeRange,
      stopSpawning: this.stopSpawning,
    }
  }

  public static decode(state: Season570208DismantleRcl2RoomProcessState): Season570208DismantleRcl2RoomProcess {
    const target = ((): AnyStructure | null => {
      if (state.ti == null) {
        return null
      }
      return Game.getObjectById(state.ti)
    })()
    return new Season570208DismantleRcl2RoomProcess(state.l, state.i, state.p, state.tr, state.w, target, state.n, state.fleeRange, state.stopSpawning)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], creepCount: number): Season570208DismantleRcl2RoomProcess {
    return new Season570208DismantleRcl2RoomProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, null, creepCount, 6, false)
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      roomLink(this.targetRoomName)
    ]
    if (this.stopSpawning === true) {
      descriptions.push("spawning stopped")
    }
    return descriptions.join(" ")
  }

  public didReceiveMessage(message: string): string {
    const components = message.split(" ")
    const command = components[0]
    if (command == null) {
      return "empty message"
    }
    switch (command) {
    case "stop":
      this.stopSpawning = true
      return "Spawning stopped"
    case "resume":
      this.stopSpawning = false
      return "Spawning resumed"
    case "flee": {
      const rawRange = components[1]
      if (rawRange == null) {
        return "No range argument"
      }
      const fleeRange = parseInt(rawRange, 10)
      if (isNaN(fleeRange) === true) {
        return `Invalid flee range ${rawRange}`
      }
      this.fleeRange = fleeRange
      return `Flee range ${fleeRange} set`
    }
    case "creep": {
      const rawCreeps = components[1]
      if (rawCreeps == null) {
        return "No range argument"
      }
      const numberOfCreeps = parseInt(rawCreeps, 10)
      if (isNaN(numberOfCreeps) === true) {
        return `Invalid creep count ${rawCreeps}`
      }
      this.numberOfCreeps = numberOfCreeps
      return `${numberOfCreeps} creeps set`
    }
    default:
      return `Invalid command ${command}`
    }
  }

  public runOnTick(): void {
    ((): void => {
      const targetRoom = Game.rooms[this.targetRoomName]
      if (targetRoom?.controller == null) {
        return
      }
      if (targetRoom.controller.safeMode == null) {
        return
      }
      this.stopSpawning = true
    })()

    this.runScout()


    // if (insufficientCreepCount > 0) {
    //   const priority: CreepSpawnRequestPriority = insufficientCreepCount > 2 ? CreepSpawnRequestPriority.High : CreepSpawnRequestPriority.Low
    //   this.requestDismantler(priority, insufficientCreepCount)
    // }

    // World.resourcePools.assignTasks(
    //   this.parentRoomName,
    //   this.identifier,
    //   CreepPoolAssignPriority.Low,
    //   creep => this.newDismantlerTask(creep),
    //   () => true,
    // )
  }

  private requestDismantler(priority: CreepSpawnRequestPriority, numberOfCreeps: number): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority,
      numberOfCreeps,
      codename: this.codename,
      roles: this.dismantlerRoles,
      body: this.dismantlerBody,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private newDismantlerTask(creep: Creep): CreepTask | null {
    if (creep.room.name !== this.targetRoomName) {
      return MoveToRoomTask.create(this.targetRoomName, this.waypoints)
    }

    const attackerTarget = ((): AnyStructure | null => {
      if (this.target != null) {
        return this.target
      }
      return this.structureTarget(creep)
    })()

    if (attackerTarget == null) {
      if (creep.room.controller != null) {
        return MoveToTask.create(creep.room.controller.pos, 2)
      }
      return null
    }

    return MoveToTargetTask.create(DismantleApiWrapper.create(attackerTarget))
  }

  private structureTarget(creep: Creep): AnyStructure | null {
    const structures = creep.room.find(FIND_HOSTILE_STRUCTURES)
    const spawn = structures.find(structure => structure instanceof StructureSpawn)
    if (spawn != null) {
      return spawn
    }
    const extension = structures.find(structure => structure instanceof StructureExtension)
    if (extension != null) {
      return extension
    }
    const road = creep.pos.findClosestByRange(structures.filter(structure => structure instanceof StructureRoad))
    return road ?? null
  }

  private runScout(): void {
    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    const insufficientCreepCount = this.numberOfCreeps - creepCount
    if (insufficientCreepCount > 0) {
      this.sendScout()
    }
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => FleeFromAttackerTask.create(this.removeConstructionSiteTask(creep), this.fleeRange),
      () => true,
    )
  }

  private sendScout(): void {
    // const childTasks: CreepTask[] = [
    //   MoveToRoomTask.create("W25S25", []),
    //   MoveToTask.create(new RoomPosition(49, 18, "W25S25"), 0),
    //   MoveToRoomTask.create(this.targetRoomName, ["W24S22"]),
    // ]
    // const options: SequentialTaskOptions = {
    //   ignoreFailure: false,
    //   finishWhenSucceed: false,
    // }
    // const initialTask = SequentialTask.create(childTasks, options)

    if (this.stopSpawning === true) {
      return
    }

    const initialTask = MoveToRoomTask.create(this.targetRoomName, this.waypoints)

    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.High,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [CreepRole.Scout],
      body: this.scoutBody,
      initialTask,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private scoutMoveToFlagTask(creep: Creep): CreepTask | null {
    if (creep.room.name !== this.targetRoomName) {
      return MoveToRoomTask.create(this.targetRoomName, [])
    }

    const targetedBy = (position: RoomPosition): number => {
      return World.resourcePools.countCreeps(this.parentRoomName, this.identifier, creep => {
        if (creep.v5task == null) {
          return false
        }
        if (!(creep.v5task instanceof SequentialTask)) {
          return false
        }
        const moveToTask = creep.v5task.childTasks.find(task => task instanceof MoveToTask) as MoveToTask | undefined
        if (moveToTask == null) {
          return false
        }
        if (moveToTask.destinationPosition.isEqualTo(position)) {
          return true
        }
        return false
      })
    }

    const flags = creep.room.find(FIND_FLAGS).sort((lhs, rhs) => {
      return targetedBy(lhs.pos) < targetedBy(rhs.pos) ? -1 : 1
    })
    const targetFlag = flags[0]
    if (targetFlag == null) {
      return null
    }

    const tasks: CreepTask[] = [
      MoveToTask.create(targetFlag.pos, 0),
      EndlessTask.create(),
    ]
    const options: SequentialTaskOptions = {
      ignoreFailure: false,
      finishWhenSucceed: false,
    }

    return SequentialTask.create(tasks, options)
  }

  private removeConstructionSiteTask(creep: Creep): CreepTask {
    const targetSite = this.targetConstructionSite(creep)
    if (targetSite == null) {
      const [position, range] = ((): [RoomPosition, number] => {
        if (creep.room.controller != null) {
          return [creep.room.controller.pos, 5]
        }
        return [creep.pos, 0]
      })()
      return MoveToTask.create(position, range)
    }
    if (targetSite.pos.isEqualTo(creep.pos) === true) {
      const i = (Game.time % 3) - 1
      const j = ((Game.time + 1) % 3) - 1
      const position = new RoomPosition(targetSite.pos.x + i, targetSite.pos.y + j, creep.room.name)
      return MoveToTask.create(position, 0)
    }

    // if ((creep.ticksToLive ?? 0) > 10 && creep.pos.isNearTo(targetSite.pos) === true) {
    //   if (targetSite.progress < (targetSite.progressTotal / 2)) {
    //     const attackBodyParts: BodyPartConstant[] = [ATTACK, RANGED_ATTACK]
    //     if (creep.pos.findInRange(FIND_HOSTILE_CREEPS, 4).some(creep => creep.body.some(body => attackBodyParts.includes(body.type))) !== true) {
    //       return null
    //     }
    //   }
    // }
    return MoveToTask.create(targetSite.pos, 0, {ignoreSwamp: true})
  }

  private targetConstructionSite(creep: Creep): ConstructionSite<BuildableStructureConstant> | null {
    // const constructionSitePriority = (structureType: StructureConstant): number => {
    //   const priority: StructureConstant[] = [
    //     STRUCTURE_TOWER,
    //     STRUCTURE_SPAWN,
    //     STRUCTURE_STORAGE,
    //     STRUCTURE_TERMINAL,
    //     STRUCTURE_LAB,
    //     STRUCTURE_EXTENSION,
    //   ]
    //   const index = priority.indexOf(structureType)
    //   if (index < 0) {
    //     return 100
    //   }
    //   return index
    // }

    const constructionSites = creep.room.find(FIND_HOSTILE_CONSTRUCTION_SITES)
      .filter(site => {
        return site.pos.findInRange(FIND_HOSTILE_STRUCTURES, 0, { filter: { structureType: STRUCTURE_RAMPART } }).length <= 0
      })

    const towerSite = constructionSites.find(site => site.structureType === STRUCTURE_TOWER)
    if (towerSite != null) {
      return towerSite
    }
    const spawnSite = constructionSites.find(site => site.structureType === STRUCTURE_SPAWN)
    if (spawnSite != null) {
      return spawnSite
    }
    const targetSite = creep.pos.findClosestByRange(constructionSites)
    if (targetSite != null) {
      return targetSite
    }

    return creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES)
  }

  private checkScoutAttacked(): boolean {
    const targetRoom = Game.rooms[this.targetRoomName]
    if (targetRoom == null) {
      return false
    }

    const hasMyTombstone = targetRoom.find(FIND_TOMBSTONES).some(tomb => tomb.creep.my === true && (tomb.creep.ticksToLive ?? 0) > 1)
    return hasMyTombstone
  }
}
