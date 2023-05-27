import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import type { RoomName } from "shared/utility/room_name_types"
import { ProcessDecoder } from "process/process_decoder"
import { RoomResources } from "room_resource/room_resources"
import { UniqueId } from "utility/unique_id"

ProcessDecoder.register("World42791528ProblemFinderProcess", state => {
  return World42791528ProblemFinderProcess.decode(state as World42791528ProblemFinderProcessState)
})

type Problem = string
type RoomLog = {
  //
}

export interface World42791528ProblemFinderProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly roomLogs: RoomLog
  readonly problems: Problem[]
}

export class World42791528ProblemFinderProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly roomLogs: RoomLog,
    private readonly problems: Problem[]
  ) {
    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
    this.codename = UniqueId.generateCodename(this.taskIdentifier, this.launchTime)
  }

  public encode(): World42791528ProblemFinderProcessState {
    return {
      t: "World42791528ProblemFinderProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      roomLogs: this.roomLogs,
      problems: this.problems,
    }
  }

  public static decode(state: World42791528ProblemFinderProcessState): World42791528ProblemFinderProcess {
    return new World42791528ProblemFinderProcess(state.l, state.i, state.roomName, state.roomLogs, state.problems)
  }

  public static create(processId: ProcessId, roomName: RoomName): World42791528ProblemFinderProcess {
    return new World42791528ProblemFinderProcess(Game.time, processId, roomName, {}, [])
  }

  public processShortDescription(): string {
    return `${roomLink(this.roomName)}`
  }

  public processDescription(): string {
    const descriptions: string[] = [
      roomLink(this.roomName),
      "problems:",
      ...this.problems,
    ]
    return descriptions.join("\n")
  }

  public runOnTick(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return
    }


    // TODO: terminal・storageを対象に行えばよいのでは
    // 問題の所在と解決が比較的容易
  }
}
