import { Process, ProcessDependencies, ProcessId } from "../../process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { RoomName } from "shared/utility/room_name_types"
import { RoomExit } from "shared/utility/room_exit"
import { Result } from "shared/utility/result_v2"


type RoomExitFailureReasonSameRoom = {
  readonly case: "same room"
  readonly roomName: RoomName
}
type RoomExitFailureReasonNotSupported = {  /// 手動で実装している間のみ発生しうるエラー
  readonly case: "not supported"
}
type RoomExitFailureReason = RoomExitFailureReasonSameRoom | RoomExitFailureReasonNotSupported

export type RoomPathfindingProcessAPI = {
  exitTo(targetRoomName: RoomName, currentRoomName: RoomName): Result<RoomExit, RoomExitFailureReason>
  // exitsTo(targetRoomName: RoomName, currentRoomName: RoomName): RoomPosition[] // TODO:
}

type RoomPathfindingProcessState = {
  // TODO: メッセージで追加できるようにする
}

ProcessDecoder.register("RoomPathfindingProcess", (processId: RoomPathfindingProcessId, state: RoomPathfindingProcessState) => RoomPathfindingProcess.decode(processId, state))

export type RoomPathfindingProcessId = ProcessId<void, "RoomPathFinding", RoomPathfindingProcessAPI, RoomPathfindingProcessState, RoomPathfindingProcess>


export class RoomPathfindingProcess extends Process<void, "RoomPathFinding", RoomPathfindingProcessAPI, RoomPathfindingProcessState, RoomPathfindingProcess> {
  public readonly identifier = "RoomPathFinding"
  public readonly dependencies: ProcessDependencies = {
    processes: [],
  }

  private constructor(
    public readonly processId: RoomPathfindingProcessId,
  ) {
    super()
  }

  public encode(): RoomPathfindingProcessState {
    return {
    }
  }

  public static decode(processId: RoomPathfindingProcessId, state: RoomPathfindingProcessState): RoomPathfindingProcess {
    return new RoomPathfindingProcess(processId)
  }

  public static create(processId: RoomPathfindingProcessId): RoomPathfindingProcess {
    return new RoomPathfindingProcess(processId)
  }

  public getDependentData(): void { }

  public staticDescription(): string {
    return ""
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(): RoomPathfindingProcessAPI {
    return {
      exitTo(targetRoomName: RoomName, currentRoomName: RoomName): Result<RoomExit, RoomExitFailureReason> {
        return this.exitTo(targetRoomName, currentRoomName)
      },
    }
  }

  // Private
  private exitTo(targetRoomName: RoomName, currentRoomName: RoomName): Result<RoomExit, RoomExitFailureReason> {
    if (targetRoomName === currentRoomName) {
      return {
        case: "failed",
        error: {
          case: "same room",
          roomName: targetRoomName,
        },
      }
    }

    switch (targetRoomName) { // FixMe:
    case "E31N57":
      switch (currentRoomName) {
      case "E32N58":
        return {
          case: "succeeded",
          value: {
            direction: LEFT,
            position: 46,
          }
        }
      case "E31N58":
        return {
          case: "succeeded",
          value: {
            direction: BOTTOM,
            position: 45,
          }
        }
      default:
        return {
          case: "failed",
          error: {
            case: "not supported",
          }
        }
      }
    default:
      return {
        case: "failed",
        error: {
          case: "not supported",
        }
      }
    }
  }
}
