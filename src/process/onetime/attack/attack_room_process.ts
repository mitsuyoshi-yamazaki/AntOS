import { GameMap } from "game/game_map"
import { MessageObserver } from "os/infrastructure/message_observer"
import { OperatingSystem } from "os/os"
import { Process, ProcessId } from "process/process"
import { ProcessDecoder } from "process/process_decoder"
import { ProcessState } from "process/process_state"
import { Season570208DismantleRcl2RoomProcess } from "process/temporary/season_570208_dismantle_rcl2_room_process"
import { RoomName } from "utility/room_name"
import { } from "./construction_saboteur_process"

ProcessDecoder.register("AttackRoomProcess", state => {
  return AttackRoomProcess.decode(state as AttackRoomProcessState)
})

type ObserveRecord = {
  readonly safemodeEndsAt: number | null
  readonly observedAt: number
}

type TargetRoomInfo = {
  readonly roomName: RoomName
  observeRecord: ObserveRecord | null
  readonly actions: {
    constructionSaboteur: boolean // 斥候がいなければ情報が取れないため常に実行される想定
    dismantle: boolean
    attack: boolean
  }
}

type ChildProcessInfo = {
  readonly constructionSaboteurProcessId: ProcessId
  readonly dismantleProcessIds: ProcessId[]
  readonly attackProcessIds: ProcessId[]
}

interface AttackRoomProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetRoomInfo: TargetRoomInfo
  readonly childProcessInfo: ChildProcessInfo
}

export class AttackRoomProcess implements Process, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly targetRoomInfo: TargetRoomInfo,
    private readonly childProcessInfo: ChildProcessInfo,
  ) {
    this.identifier = `${this.constructor.name}`
  }

  public encode(): AttackRoomProcessState {
    return {
      t: "AttackRoomProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetRoomInfo: this.targetRoomInfo,
      childProcessInfo: this.childProcessInfo,
    }
  }

  public static decode(state: AttackRoomProcessState): AttackRoomProcess {
    return new AttackRoomProcess(state.l, state.i, state.roomName, state.targetRoomInfo, state.childProcessInfo)
  }

  public static create(processId: ProcessId, roomName: RoomName, targetRoomName: RoomName): AttackRoomProcess {
    const targetRoomInfo: TargetRoomInfo = {
      roomName: targetRoomName,
      observeRecord: null,
      actions: {
        constructionSaboteur: false,
        dismantle: false,
        attack: false,
      }
    }

    const waypoints = GameMap.getWaypoints(roomName, targetRoomName) ?? []
    const constructionSaboteurProcess = OperatingSystem.os.addProcess(processId, childProcessId => {
      return Season570208DismantleRcl2RoomProcess.create(childProcessId, roomName, targetRoomName, waypoints, 1)
    })
    constructionSaboteurProcess.setKeepSpawning()

    const childProcessInfo: ChildProcessInfo = {
      constructionSaboteurProcessId: constructionSaboteurProcess.processId,
      dismantleProcessIds: [],
      attackProcessIds: [],
    }

    return new AttackRoomProcess(Game.time, processId, roomName, targetRoomInfo, childProcessInfo)
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "activate", "deactivate"]

    const components = message.split(" ")
    const command = components.shift()

    switch (command) {
    case "help":
      return `Commands: ${commandList}`

    case "activate":
      return this.toggle(components[0] ?? null, true)

    case "deactivate":
      return this.toggle(components[0] ?? null, false)

    default:
      return `Invalid command ${command}. "help" to show command list`
    }
  }

  private toggle(action: string | null, activated: boolean): string {
    const actionList = ["construction_saboteur", "dismantle", "attack"]
    switch (action) {
    case "construction_saboteur": {
      const oldValue = this.targetRoomInfo.actions.constructionSaboteur
      this.targetRoomInfo.actions.constructionSaboteur = activated
      return `set ${action} ${oldValue} => ${activated}`
    }
    case "dismantle": {
      const oldValue = this.targetRoomInfo.actions.dismantle
      this.targetRoomInfo.actions.dismantle = activated
      return `set ${action} ${oldValue} => ${activated}`
    }
    case "attack": {
      const oldValue = this.targetRoomInfo.actions.attack
      this.targetRoomInfo.actions.attack = activated
      return `set ${action} ${oldValue} => ${activated}`
    }
    default:
      return `Invalid action ${action}. Available actions are: ${actionList}`
    }
  }

  public runOnTick(): void {
    const targetRoom = Game.rooms[this.targetRoomInfo.roomName]
    if (targetRoom == null) {
      return  // constructionSaboteurProcessが動いているはず
    }
    if (targetRoom.controller == null) {
      return
    }
    const controller = targetRoom.controller

    const safemodeEndsAt = ((): number | null => {
      if (controller.safeMode == null) {
        return null
      }
      return controller.safeMode + Game.time
    })()

    const observeRecord: ObserveRecord = {
      observedAt: Game.time,
      safemodeEndsAt,
    }

    this.targetRoomInfo.observeRecord = observeRecord
  }
}
