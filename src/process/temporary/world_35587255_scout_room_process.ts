import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomCoordinate, RoomName } from "utility/room_name"
import { coloredText, roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { Timestamp } from "utility/timestamp"
import { RoomResources } from "room_resource/room_resources"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { GameConstants } from "utility/constants"
import { processLog } from "os/infrastructure/logger"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { ProcessDecoder } from "process/process_decoder"

ProcessDecoder.register("World35587255ScoutRoomProcess", state => {
  return World35587255ScoutRoomProcess.decode(state as World35587255ScoutRoomProcessState)
})

const targetRoomRange = 10
const normalRoomCheckInterval = 5000
const hostileRoomCheckInterval = 10000
const spawnInterval = GameConstants.creep.life.lifeTime

export interface World35587255ScoutRoomProcessState extends ProcessState {
  /** parent room name */
  readonly p: RoomName

  readonly targetRoomNames: RoomName[] | null
  readonly lastSpawnTime: Timestamp
}

/** 周囲の自動偵察process */
// Game.io("launch -l World35587255ScoutRoomProcess room_name=W19S19")
export class World35587255ScoutRoomProcess implements Process, Procedural {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    private targetRoomNames: RoomName[] | null,
    private lastSpawnTime: Timestamp,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): World35587255ScoutRoomProcessState {
    return {
      t: "World35587255ScoutRoomProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      targetRoomNames: this.targetRoomNames,
      lastSpawnTime: this.lastSpawnTime,
    }
  }

  public static decode(state: World35587255ScoutRoomProcessState): World35587255ScoutRoomProcess {
    return new World35587255ScoutRoomProcess(state.l, state.i, state.p, state.targetRoomNames, state.lastSpawnTime)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName): World35587255ScoutRoomProcess {
    return new World35587255ScoutRoomProcess(Game.time, processId, parentRoomName, null, 0)
  }

  public processShortDescription(): string {
    const creep = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)[0]
    const currentLocation = creep != null ? `${roomLink(creep.room.name)}` : "none"
    return `from: ${roomLink(this.parentRoomName)}, current: ${currentLocation}`
  }

  public runOnTick(): void {
    const resources = RoomResources.getOwnedRoomResource(this.parentRoomName)
    if (resources == null) {
      PrimitiveLogger.fatal(`${roomLink(this.parentRoomName)} lost`)
      return
    }

    if (this.targetRoomNames == null) {
      this.targetRoomNames = this.getTargetRooms()
    }

    const shouldSpawn = ((): boolean => {
      if (this.targetRoomNames == null || this.targetRoomNames.length <= 0) {
        return false
      }
      if ((Game.time - this.lastSpawnTime) < spawnInterval) {
        return false
      }
      if (resources.activeStructures.towers.length <= 0) {
        return false
      }
      const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
      if (creepCount >= 1) {
        return false
      }
      return true
    })()
    if (shouldSpawn === true) {
      this.spawnCreep()
    }

    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.newTaskFor(creep),
      () => true,
    )
  }

  private spawnCreep(): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [CreepRole.Scout, CreepRole.Mover],
      body: [MOVE],
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private newTaskFor(creep: Creep): CreepTask | null {
    if (creep.ticksToLive == null || creep.ticksToLive > 1490) {
      this.lastSpawnTime = Game.time
    }

    if (this.targetRoomNames == null) {
      // PrimitiveLogger.programError(`${this.identifier} target room names is null`)
      return null
    }
    const lastDestination = this.targetRoomNames.pop()
    if (lastDestination == null) {
      // PrimitiveLogger.programError(`${this.identifier} target room names is empty`)
      return null
    }

    processLog(this, `${coloredText("[Info]", "info")} ${this.targetRoomNames.length} target rooms: ${this.targetRoomNames.map(roomName => roomLink(roomName)).join(", ")}`)
    const task = FleeFromAttackerTask.create(MoveToRoomTask.create(lastDestination, this.targetRoomNames))
    this.targetRoomNames = null
    return task
  }

  private getTargetRooms(): RoomName[] {
    const parentRoomName = this.parentRoomName
    const roomsToAvoid: RoomName[] = []
    const rooms: { roomName: RoomName, distanceFromParent: number }[] = []
    const parentRoomCoordinate = RoomCoordinate.parse(parentRoomName)
    if (parentRoomCoordinate == null) {
      PrimitiveLogger.fatal(`${this.identifier} cannot retrieve room coordinate for ${roomLink(parentRoomName)}`)
      return []
    }
    const radius = Math.floor(targetRoomRange / 2)

    for (let j = 0; j < targetRoomRange; j += 1) {
      for (let i = 0; i < targetRoomRange; i += 1) {
        const dx = i - radius
        const dy = j - radius
        const coordinate = parentRoomCoordinate.getRoomCoordinateTo(dx, dy)
        const roomName = coordinate.roomName
        if (Game.map.getRoomStatus(roomName).status !== "normal") {
          continue
        }
        const roomInfo = RoomResources.getRoomInfo(roomName)
        const roomState = ((): "hostile" | "normal" | "observed" => {
          if (roomInfo == null) {
            return "normal"
          }
          if (roomInfo.roomType !== "normal") {
            return "observed"
          }
          if (roomInfo.owner == null) {
            if ((Game.time - roomInfo.observedAt) < normalRoomCheckInterval) {
              return "observed"
            }
            return "normal"
          }
          switch (roomInfo.owner.ownerType) {
          case "reserve":
            if ((Game.time - roomInfo.observedAt) < normalRoomCheckInterval) {
              return "observed"
            }
            return "normal"
          case "claim":
            if ((Game.time - roomInfo.observedAt) < hostileRoomCheckInterval) {
              return "hostile"
            }
            return "normal"
          }
        })()

        switch (roomState) {
        case "observed":
          break
        case "normal":
          rooms.push({
            roomName,
            distanceFromParent: Game.map.getRoomLinearDistance(roomName, parentRoomName),
          })
          break
        case "hostile":
          roomsToAvoid.push(roomName)
          break
        }

        if (roomInfo != null && roomInfo.reachable !== true) {
          if (roomsToAvoid.includes(roomName) !== true) {
            roomsToAvoid.push(roomName)
          }
        }
      }
    }

    if (rooms.length <= 0) {
      PrimitiveLogger.fatal(`${this.identifier} ${roomLink(parentRoomName)} no rooms to observe`)
      return []
    }

    const routeCallback = (roomName: RoomName): number => {
      if (roomsToAvoid.includes(roomName) === true) {
        return Infinity
      }
      return 1
    }

    const result: RoomName[] = []
    let roomName = parentRoomName
    const roomCount = rooms.length

    for (let i = 0; i < roomCount; i += 1) {
      const roomDistances: { roomName: RoomName, distanceFromParent: number, distanceFromRoom: number }[] = rooms.map(r => ({
        roomName: r.roomName,
        distanceFromParent: r.distanceFromParent,
        distanceFromRoom: Game.map.getRoomLinearDistance(r.roomName, roomName),
      }))
      const closestRoom = roomDistances.sort((lhs, rhs) => {
        if (lhs.distanceFromRoom === rhs.distanceFromRoom) {
          return lhs.distanceFromParent - rhs.distanceFromParent
        }
        return lhs.distanceFromRoom - rhs.distanceFromRoom
      })[0]
      if (closestRoom == null) {
        return result
      }
      const route = Game.map.findRoute(roomName, closestRoom.roomName, {routeCallback})
      if (route === ERR_NO_PATH) {
        const descriptions: string[] = [
          `World35587255ScoutRoomProcess.getTargetRooms() parent: ${roomLink(parentRoomName)}, no path from ${roomLink(roomName)} to ${roomLink(closestRoom.roomName)}`
        ]

        const destinationRoomInfo = RoomResources.getRoomInfo(closestRoom.roomName)
        if (destinationRoomInfo != null) {
          destinationRoomInfo.reachable = false
          descriptions.push("marked as non reachable")
        }

        const message = descriptions.join(", ")
        PrimitiveLogger.log(message)
        // PrimitiveLogger.fatal(message)
        return result
      }
      const index = rooms.findIndex(r => r.roomName === closestRoom.roomName)
      if (index >= 0) {
        rooms.splice(index, 1)
      }
      result.push(...route.map(r => r.room))
      roomName = closestRoom.roomName
    }

    return result
  }
}
