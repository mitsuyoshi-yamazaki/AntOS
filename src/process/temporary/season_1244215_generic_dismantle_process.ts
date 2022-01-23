import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { isRoomName, RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepName, isV5CreepMemory } from "prototype/creep"
import { processLog } from "os/infrastructure/logger"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { DismantleApiWrapper } from "v5_object_task/creep_task/api_wrapper/dismantle_api_wrapper"
import { OperatingSystem } from "os/os"
import { CreepBody } from "utility/creep_body"
import { RoomResources } from "room_resource/room_resources"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { MessageObserver } from "os/infrastructure/message_observer"
import { ProcessDecoder } from "process/process_decoder"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { CreepTask } from "v5_object_task/creep_task/creep_task"

ProcessDecoder.register("Season1244215GenericDismantleProcess", state => {
  return Season1244215GenericDismantleProcess.decode(state as Season1244215GenericDismantleProcessState)
})

const dismantlerRole: CreepRole[] = [CreepRole.Worker, CreepRole.Mover]

export interface Season1244215GenericDismantleProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  targetIds: Id<AnyStructure>[]
  creepName: CreepName | null
  action: "specified target only" | null
  noFlee: boolean
}

export class Season1244215GenericDismantleProcess implements Process, Procedural, MessageObserver {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public targetRoomName: RoomName,
    public waypoints: RoomName[],
    private creepName: CreepName | null,
    private targetIds: Id<AnyStructure>[],
    private action: "specified target only" | null,
    private noFlee: boolean,
  ) {
    this.identifier = `${this.constructor.name}_${this.launchTime}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season1244215GenericDismantleProcessState {
    return {
      t: "Season1244215GenericDismantleProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      creepName: this.creepName,
      targetIds: this.targetIds,
      action: this.action,
      noFlee: this.noFlee,
    }
  }

  public static decode(state: Season1244215GenericDismantleProcessState): Season1244215GenericDismantleProcess {
    return new Season1244215GenericDismantleProcess(state.l, state.i, state.p, state.tr, state.w, state.creepName, state.targetIds, state.action, state.noFlee ?? true)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], targetId: Id<AnyStructure> | null): Season1244215GenericDismantleProcess {
    const targetIds: Id<AnyStructure>[] = []
    if (targetId != null) {
      targetIds.push(targetId)
    }
    return new Season1244215GenericDismantleProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, null, targetIds, null, false)
  }

  public processShortDescription(): string {
    const creepDescription = ((): string => {
      if (this.creepName == null) {
        return "not spawned"
      }
      if (Game.creeps[this.creepName] == null) {
        return "creep dead"
      }
      return "running"
    })()
    return `${roomLink(this.targetRoomName)} ${creepDescription}`
  }

  public didReceiveMessage(message: string): string {
    if (message === "clear") {
      this.targetIds.splice(0, this.targetIds.length)
      return "target cleared"
    }
    if (message === "status") {
      const creepDescription = ((): string => {
        if (this.creepName == null) {
          return "not spawned"
        }
        const creep = Game.creeps[this.creepName]
        if (creep == null) {
          return "creep died"
        }
        return `${creep.name} in ${roomLink(creep.room.name)}`
      })()
      const descriptions: string[] = [
        creepDescription,
        (this.targetIds.length <= 0 ? "no targets" : `targets: ${this.targetIds.join(",")}`),
      ]
      return descriptions.join(", ")
    }
    if (message.startsWith("change target ")) {
      const rawRooms = message.slice(14)
      const roomNames = rawRooms.split(",")
      if (rawRooms.length <= 0 || roomNames.length <= 0) {
        return "no target room specified"
      }
      if (roomNames.some(roomName => !isRoomName(roomName)) === true) {
        return `invalid room name ${roomNames}`
      }
      const targetRoomName = roomNames.pop()
      if (targetRoomName == null) {
        return "can't retrieve target room"
      }
      if (this.creepName != null) {
        const creep = Game.creeps[this.creepName]
        if (creep != null && isV5CreepMemory(creep.memory)) {
          creep.memory.t = null
        }
      }
      this.waypoints = roomNames
      this.targetRoomName = targetRoomName
      return `target room: ${this.targetRoomName}, waypoints: ${roomNames} set`
    }
    if (message === "specified target only") {
      this.action = "specified target only"
      return '"specified target only" set'
    }
    if (message === "clear action") {
      this.action = null
      return "action cleared"
    }
    if (message === "noflee") {
      this.noFlee = true
      return "no flee"
    }
    if (message.length <= 0) {
      return "Empty message"
    }
    this.targetIds.unshift(message as Id<AnyStructure>)
    if (this.creepName != null) {
      const creep = Game.creeps[this.creepName]
      if (creep != null && isV5CreepMemory(creep.memory)) {
        creep.memory.t = null
      }
    }
    return `target ${message} set`
  }

  public runOnTick(): void {
    if (this.creepName == null) {
      const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)
      if (creeps[0] != null) {
        this.creepName = creeps[0].name
      } else {
        const resources = RoomResources.getOwnedRoomResource(this.parentRoomName)
        if (resources == null) {
          PrimitiveLogger.fatal(`${this.identifier} ${roomLink(this.parentRoomName)} lost`)
          return
        }

        this.requestDismantler(resources)
        return
      }
    }
    const creep = Game.creeps[this.creepName]
    if (creep == null) {
      processLog(this, `Creep dead (target: ${this.targetRoomName})`)
      OperatingSystem.os.killProcess(this.processId)
      return
    }

    this.runCreep(creep)
  }

  private runCreep(creep: Creep): void {
    if (creep.v5task != null) {
      if ((creep.v5task instanceof MoveToTargetTask) && (creep.v5task.apiWrapper instanceof DismantleApiWrapper)) {
        if (creep.pos.isNearTo(creep.v5task.apiWrapper.target) !== true) {
          const nearbyStructure = creep.pos.findInRange(FIND_HOSTILE_STRUCTURES, 1)[0]
          if (nearbyStructure != null) {
            creep.dismantle(nearbyStructure)
          }
        }
      }
      return
    }

    if (creep.room.name !== this.targetRoomName) {
      const waypoints: RoomName[] = creep.room.name === this.parentRoomName ? this.waypoints : []
      creep.v5task = MoveToRoomTask.create(this.targetRoomName, waypoints)
      return
    }

    // const constructionSite = this.constructionSite(creep)
    // if (constructionSite != null) {
    //   creep.v5task = MoveToTask.create(constructionSite.pos, 0)
    //   return
    // }

    const target = this.getTarget(creep)
    if (target == null) {
      creep.v5task = this.wrappedTask(MoveToTask.create(creep.pos, 1)) // 何もしないが、FleeFromAttackerTaskを動かすため必要
      return
    }
    creep.v5task = this.wrappedTask(MoveToTargetTask.create(DismantleApiWrapper.create(target)))
  }

  private wrappedTask(task: CreepTask): CreepTask {
    if (this.noFlee === true) {
      return task
    }
    return FleeFromAttackerTask.create(task)
  }

  private constructionSite(creep: Creep): ConstructionSite | null {
    const constructionSites = creep.room.find(FIND_HOSTILE_CONSTRUCTION_SITES).filter(site => {
      if (site.progress <= 0) {
        return false
      }
      if (site.pos.v5TargetedBy.length > 0) {
        return false
      }
      return true
    })
    return creep.pos.findClosestByRange(constructionSites) ?? null
  }

  private getTarget(creep: Creep): AnyStructure | null {
    const controller = creep.room.controller
    if (controller != null && ((controller.my === true) || (controller.reservation != null && controller.reservation.username === Game.user.name))) {
      return null
    }

    const target = ((): AnyStructure | null => {
      const targetIds = [...this.targetIds]
      for (let i = 0; i < this.targetIds.length; i += 1) {
        const targetId = targetIds.shift()
        if (targetId == null) {
          return null
        }
        const storedTarget = Game.getObjectById(targetId)
        if (storedTarget == null) {
          processLog(this, `Target destroyed (target: ${this.targetRoomName})`)
          const index = this.targetIds.indexOf(targetId)
          if (index >= 0) {
            this.targetIds.splice(index, 1)
          }
          return null
        }
        if (storedTarget.room.name !== creep.room.name) {
          return null
        }
        return storedTarget
      }
      return null
    })()
    if (target != null) {
      return target
    }
    if (this.action === "specified target only") {
      return null
    }

    const excluded: StructureConstant[] = [
      STRUCTURE_CONTROLLER,
      STRUCTURE_STORAGE,  // storage等を破壊する場合は明示的に指定する
      STRUCTURE_TERMINAL,
      STRUCTURE_KEEPER_LAIR,
      STRUCTURE_INVADER_CORE, // dismantleで破壊できない(-7)
      STRUCTURE_EXTRACTOR,
    ]
    const targetPriority: StructureConstant[] = [ // 添字の大きい方が優先
      STRUCTURE_CONTAINER,
      STRUCTURE_ROAD,
      STRUCTURE_RAMPART,
      STRUCTURE_LINK,
      STRUCTURE_EXTRACTOR,
      STRUCTURE_STORAGE,
      STRUCTURE_POWER_SPAWN,
      STRUCTURE_TERMINAL,
      STRUCTURE_EXTENSION,
      STRUCTURE_SPAWN,
      STRUCTURE_TOWER,
    ]
    const hostileStructure = creep.room.find(FIND_STRUCTURES)
      .filter(structure => {
        if ((structure as {my?: boolean}).my === true) {
          return false
        }
        if (excluded.includes(structure.structureType) === true) {
          return false
        }
        if (structure instanceof StructureInvaderCore) {
          if (structure.ticksToDeploy != null && structure.ticksToDeploy >= 0) {
            return false
          }
        }
        return true
      })
      .sort((lhs, rhs) => {
        const priority = targetPriority.indexOf(rhs.structureType) - targetPriority.indexOf(lhs.structureType)
        if (priority !== 0) {
          return priority
        }
        return lhs.pos.getRangeTo(creep.pos) - rhs.pos.getRangeTo(creep.pos)
      })[0]
    return hostileStructure ?? null
  }

  private requestDismantler(resources: OwnedRoomResource): void {
    const bodyUnit: BodyPartConstant[] = [
      WORK, WORK, WORK, WORK, WORK,
      MOVE, MOVE, MOVE, MOVE, MOVE,
    ]
    const body = CreepBody.create([], bodyUnit, resources.room.energyCapacityAvailable, 5)

    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: dismantlerRole,
      body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }
}
