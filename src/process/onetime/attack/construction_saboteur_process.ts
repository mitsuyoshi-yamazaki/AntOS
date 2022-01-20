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
import { SequentialTask, SequentialTaskOptions } from "v5_object_task/creep_task/combined_task/sequential_task"
import { EndlessTask } from "v5_object_task/creep_task/meta_task/endless_task"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { ProcessDecoder } from "process/process_decoder"
import { MessageObserver } from "os/infrastructure/message_observer"

ProcessDecoder.register("ConstructionSaboteurProcess", state => {
  return ConstructionSaboteurProcess.decode(state as ConstructionSaboteurProcessState)
})

export interface ConstructionSaboteurProcessState extends ProcessState {
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

export class ConstructionSaboteurProcess implements Process, Procedural, MessageObserver {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

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

  public encode(): ConstructionSaboteurProcessState {
    return {
      t: "ConstructionSaboteurProcess",
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

  public static decode(state: ConstructionSaboteurProcessState): ConstructionSaboteurProcess {
    const target = ((): AnyStructure | null => {
      if (state.ti == null) {
        return null
      }
      return Game.getObjectById(state.ti)
    })()
    return new ConstructionSaboteurProcess(state.l, state.i, state.p, state.tr, state.w, target, state.n, state.fleeRange, state.stopSpawning)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], creepCount: number): ConstructionSaboteurProcess {
    return new ConstructionSaboteurProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, null, creepCount, 6, false)
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
    return MoveToTask.create(targetSite.pos, 0, { ignoreSwamp: true })
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
        if (site.pos.findInRange(FIND_HOSTILE_STRUCTURES, 0, { filter: { structureType: STRUCTURE_RAMPART } }).length > 0) {
          return false
        }
        if (site.pos.lookFor(LOOK_TERRAIN)[0] === "wall") {
          return false
        }
        return true
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

    return null
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
