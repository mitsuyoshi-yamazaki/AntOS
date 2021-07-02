import { OperatingSystem } from "os/os"
import { Procedural } from "old_objective/procedural"
import { Process, ProcessId, processLog, ProcessState } from "process/process"
import { OldClaimRoomObjective, OldClaimRoomObjectiveState } from "./old_claim_room_objective"

export interface ClaimRoomProcessState extends ProcessState {
  /** objective state */
  s: OldClaimRoomObjectiveState
}

export class ClaimRoomProcess implements Process, Procedural {
  public constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly objective: OldClaimRoomObjective,
  ) { }

  public encode(): ClaimRoomProcessState {
    return {
      t: "ClaimRoomProcess",
      l: this.launchTime,
      i: this.processId,
      s: this.objective.encode(),
    }
  }

  public static decode(state: ClaimRoomProcessState): ClaimRoomProcess {
    const objective = OldClaimRoomObjective.decode(state.s)
    return new ClaimRoomProcess(state.l, state.i, objective)
  }

  public processDescription(): string {
    return this.objective.objectiveDescription()
  }

  public runOnTick(): void {
    const progress = this.objective.progress()
    switch (progress.objectProgressType) {
    case "in progress":
      processLog(this, `ClaimRoomProcess ${this.processId} in progress: ${progress.value}`)
      return
    case "succeeded":
      processLog(this, `ClaimRoomProcess ${this.processId} successfully claimed room ${progress.result.room.name}`)
      OperatingSystem.os.killProcess(this.processId)
      return
    case "failed":
      processLog(this, `ClaimRoomProcess ${this.processId} failed with error ${progress.reason}`)
      OperatingSystem.os.killProcess(this.processId)
      return
    }
  }
}
