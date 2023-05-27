import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
import { coloredText, roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"
import { World } from "world_info/world_info"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { generateCodename } from "utility/unique_id"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { OperatingSystem } from "os/os"
import { OwnedRoomProcess } from "process/owned_room_process"
import { processLog } from "os/infrastructure/logger"
import { GameMap } from "game/game_map"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { SignApiWrapper } from "v5_object_task/creep_task/api_wrapper/sign_controller_api_wrapper"
import { Sign } from "game/sign"

ProcessDecoder.register("SignRoomsProcess", state => {
  return SignRoomsProcess.decode(state as SignRoomsProcessState)
})

interface SignRoomsProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetRoomNames: RoomName[]
  readonly finishedRoomNames: RoomName[]
  readonly signs: string[] | null
}

export class SignRoomsProcess implements Process, Procedural, OwnedRoomProcess {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }
  public get ownedRoomName(): RoomName {
    return this.roomName
  }

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly targetRoomNames: RoomName[],
    private readonly finishedRoomNames: RoomName[],
    private readonly signs: string[] | null,
  ) {
    this.identifier = `${this.constructor.name}_${this.processId}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): SignRoomsProcessState {
    return {
      t: "SignRoomsProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetRoomNames: this.targetRoomNames,
      finishedRoomNames: this.finishedRoomNames,
      signs: this.signs,
    }
  }

  public static decode(state: SignRoomsProcessState): SignRoomsProcess {
    return new SignRoomsProcess(state.l, state.i, state.roomName, state.targetRoomNames, state.finishedRoomNames, state.signs)
  }

  public static create(processId: ProcessId, roomName: RoomName, targetRoomNames: RoomName[], signs: string[] | null): SignRoomsProcess {
    return new SignRoomsProcess(Game.time, processId, roomName, targetRoomNames, [], signs)
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
    ]
    if (this.signs != null) {
      descriptions.push(`signs: ${this.signs.map(sign => `"${sign}"`).join(",")}`)
    }

    const targetRoomNames = this.targetRoomNames.filter(roomName => this.finishedRoomNames.includes(roomName) !== true)
    if (targetRoomNames.length > 0) {
      descriptions.push(`targets: ${targetRoomNames.map(roomName => roomLink(roomName)).join(",")}`)
    }

    if (this.finishedRoomNames.length > 0) {
      descriptions.push(`finished: ${this.finishedRoomNames.map(roomName => roomLink(roomName)).join(",")}`)
    }

    return descriptions.join(", ")
  }

  public runOnTick(): void {
    const shouldSpawn = ((): boolean => {
      if (this.finishedRoomNames.length >= this.targetRoomNames.length) {
        return false
      }
      const creepCount = World.resourcePools.countCreeps(this.roomName, this.taskIdentifier, () => true)
      if (creepCount > 0) {
        return false
      }
      return true
    })()

    if (shouldSpawn === true) {
      World.resourcePools.addSpawnCreepRequest(this.roomName, {
        priority: CreepSpawnRequestPriority.Low,
        numberOfCreeps: 1,
        codename: this.codename,
        roles: [],
        body: [MOVE],
        initialTask: null,
        taskIdentifier: this.taskIdentifier,
        parentRoomName: null,
      })
    }

    World.resourcePools.assignTasks(
      this.roomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => {
        const task = this.creepTask(creep)
        if (task == null) {
          return null
        }
        return FleeFromAttackerTask.create(task)
      },
      () => true,
    )
  }

  private creepTask(creep: Creep): CreepTask | null {
    const targetRoomName = this.nextTargetRoomName()

    if (targetRoomName == null) {
      creep.say("finished")
      processLog(this, `finished ${this.finishedRoomNames.length} rooms with signs: ${(this.signs ?? []).map(sign => `"${sign}"`).join(",")}`)
      OperatingSystem.os.suspendProcess(this.processId)
      return null
    }

    if (creep.room.name !== targetRoomName) {
      const waypoints = GameMap.getWaypoints(creep.room.name, targetRoomName, {ignoreMissingWaypoints: true}) ?? []
      return MoveToRoomTask.create(targetRoomName, waypoints)
    }

    const controller = creep.room.controller
    if (controller == null) {
      this.finishRoom(targetRoomName)
      creep.say(`f ${targetRoomName}`)
      return null
    }

    const canGoNext = ((): boolean => {
      if (controller.sign == null) {
        return false
      }
      if (controller.sign.username !== Game.user.name) {
        return false
      }
      if (controller.sign.time < (Game.time - 100)) {
        return false
      }
      return true
    })()

    if (canGoNext === true) {
      this.finishRoom(targetRoomName)
      creep.say(`f ${targetRoomName}`)
      return null
    }

    const options: FindPathOpts = {
      maxRooms: 1,
      maxOps: 800,
      ignoreCreeps: true,
    }
    const path = creep.room.findPath(creep.pos, controller.pos, options)
    const lastPosition = path[path.length - 1]

    if (lastPosition == null || controller.pos.isNearTo(lastPosition.x, lastPosition.y) !== true) {
      processLog(this, `${coloredText("[Warning]", "warn")} controller in ${roomLink(targetRoomName)} is blocked`)
      this.finishRoom(targetRoomName)
      creep.say(`f ${targetRoomName}`)
      return null
    }

    const sign = ((): string => {
      if (this.signs != null) {
        const randomSign = this.signs[Game.time % this.signs.length]
        if (randomSign != null) {
          return randomSign
        }
      }
      return Sign.signFor(controller)
    })()
    return MoveToTargetTask.create(SignApiWrapper.create(controller, sign))
  }

  private nextTargetRoomName(): RoomName | null {
    return this.targetRoomNames.find(roomName => this.finishedRoomNames.includes(roomName) !== true) ?? null
  }

  private finishRoom(targetRoomName: RoomName): void {
    if (this.finishedRoomNames.includes(targetRoomName) === true) {
      return
    }
    processLog(this, `signed ${roomLink(targetRoomName)}`)
    this.finishedRoomNames.push(targetRoomName)
  }
}
