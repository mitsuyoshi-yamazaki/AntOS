import { OperatingSystem } from "os/os"
import { Procedural } from "task/procedural"
import { Process, ProcessId, ProcessState } from "task/process"
import { ClaimRoomObjective, ClaimRoomObjectiveState } from "./claim_room_objective"

export interface ClaimRoomProcessState extends ProcessState {
  /** objective state */
  s: ClaimRoomObjectiveState
}

export class ClaimRoomProcess implements Process, Procedural {
  public constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly objective: ClaimRoomObjective,
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
    const objective = ClaimRoomObjective.decode(state.s)
    return new ClaimRoomProcess(state.l, state.i, objective)
  }

  public processDescription(): string {
    return this.objective.objectiveDescription()
  }

  public runOnTick(): void {
    const progress = this.objective.progress()
    switch (progress.objectProgressType) {
    case "in progress":
      console.log(`ClaimRoomProcess ${this.processId} in progress`)
      return
    case "succeeded":
      console.log(`ClaimRoomProcess ${this.processId} successfully claimed room ${progress.result.room.name}`)
      OperatingSystem.os.killProcess(this.processId)
      return
    case "failed":
      console.log(`ClaimRoomProcess ${this.processId} failed with error ${progress.reason}`)
      OperatingSystem.os.killProcess(this.processId)
      return
    }
  }
}
