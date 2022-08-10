import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { RoomName } from "utility/room_name"
import { ProcessDecoder } from "process/process_decoder"

ProcessDecoder.register("World42768365ProblemSolverProcess", state => {
  return World42768365ProblemSolverProcess.decode(state as World42768365ProblemSolverProcessState)
})

export interface World42768365ProblemSolverProcessState extends ProcessState {
  readonly roomName: RoomName
}

export class World42768365ProblemSolverProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly roomName: RoomName,
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): World42768365ProblemSolverProcessState {
    return {
      t: "World42768365ProblemSolverProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
    }
  }

  public static decode(state: World42768365ProblemSolverProcessState): World42768365ProblemSolverProcess {
    return new World42768365ProblemSolverProcess(state.l, state.i, state.roomName)
  }

  public static create(processId: ProcessId, roomName: RoomName): World42768365ProblemSolverProcess {
    if (Memory.ignoreRooms.includes(roomName) !== true) {
      Memory.ignoreRooms.push(roomName)
    }
    return new World42768365ProblemSolverProcess(Game.time, processId, roomName)
  }

  public deinit(): void {
    const index = Memory.ignoreRooms.indexOf(this.roomName)
    if (index >= 0) {
      Memory.ignoreRooms.splice(index, 1)
    }
  }

  public processShortDescription(): string {
    return `${roomLink(this.roomName)}`
  }

  public runOnTick(): void {
    // TODO:
  }
}
