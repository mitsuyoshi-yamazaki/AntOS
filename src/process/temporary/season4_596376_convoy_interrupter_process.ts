import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "process/process_decoder"
import { RoomName } from "utility/room_name"

ProcessDecoder.register("Season4596376ConvoyInterrupterProcess", state => {
  return Season4596376ConvoyInterrupterProcess.decode(state as Season4596376ConvoyInterrupterProcessState)
})

type Highway = {
  roomName1: RoomName
  roomName2: RoomName
}

export interface Season4596376ConvoyInterrupterProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly highway: Highway
}

export class Season4596376ConvoyInterrupterProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly highway: Highway,
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): Season4596376ConvoyInterrupterProcessState {
    return {
      t: "Season4596376ConvoyInterrupterProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      highway: this.highway,
    }
  }

  public static decode(state: Season4596376ConvoyInterrupterProcessState): Season4596376ConvoyInterrupterProcess {
    return new Season4596376ConvoyInterrupterProcess(state.l, state.i, state.roomName, state.highway)
  }

  public static create(processId: ProcessId, roomName: RoomName, highway: Highway): Season4596376ConvoyInterrupterProcess {
    return new Season4596376ConvoyInterrupterProcess(Game.time, processId, roomName, highway)
  }

  public processShortDescription(): string {
    return `${roomLink(this.roomName)} =&gt ${highwayDescription(this.highway)}`
  }

  public runOnTick(): void {
    // TODO: implement
  }
}

function highwayDescription(highway: Highway): string {
  return `${highway.roomName1}-${highway.roomName2}`
}
