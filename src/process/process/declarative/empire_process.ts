import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "../../process_state"
import { ProcessDecoder } from "process/process_decoder"
import { } from "./empire"
import {} from "./region"
import type { RoomName } from "shared/utility/room_name_types"
import type { Timestamp } from "shared/utility/timestamp"

ProcessDecoder.register("EmpireProcess", state => {
  return EmpireProcess.decode(state as EmpireProcessState)
})

type EmpireStateUnderAttack = {
  readonly case: "under attack"
  readonly roomName: RoomName
  readonly attackerNames: string[]
}
type EmpireStateSafemode = {
  readonly case: "safemode"
  readonly roomName: RoomName
  readonly until: Timestamp
}
type EmpireStateAttacking = {
  readonly case: "attacking"
  readonly targetRoomName: RoomName
}
type EmpireState = EmpireStateUnderAttack | EmpireStateSafemode | EmpireStateAttacking

export interface EmpireProcessState extends ProcessState {
}

export class EmpireProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): EmpireProcessState {
    return {
      t: "EmpireProcess",
      l: this.launchTime,
      i: this.processId,
    }
  }

  public static decode(state: EmpireProcessState): EmpireProcess {
    return new EmpireProcess(state.l, state.i)
  }

  public static create(processId: ProcessId): EmpireProcess {
    return new EmpireProcess(Game.time, processId)
  }

  public processShortDescription(): string {
    return "not implemented yet"
  }

  public processDescription(): string {
    const descriptions: string[] = [
      `${Game.user.name}'s Empire`,
      ...this.currentState().map(state => describeState(state)),
    ]

    return descriptions.join("\n")
  }

  public runOnTick(): void {

  }

  private currentState(): EmpireState[] {
    return [] // TODO:
  }
}

const describeState = (state: EmpireState): string => {
  return state.case // TODO:
}

class ResourceManager {
  public run(): void {

  }
}
