import { OperatingSystem } from "os/os"
import { Procedural } from "task/procedural"
import { Process, ProcessId, processLog, ProcessState } from "task/process"
import { BootstrapL8RoomObjective, BootstrapL8RoomObjectiveState } from "./bootstarp_l8_room_objective"

export interface BootstrapL8RoomProcessState extends ProcessState {
  /** objective state */
  s: BootstrapL8RoomObjectiveState
}

export class BootstrapL8RoomProcess implements Process, Procedural {
  public constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly objective: BootstrapL8RoomObjective,
  ) { }

  public encode(): BootstrapL8RoomProcessState {
    return {
      t: "BootstrapL8RoomProcess",
      l: this.launchTime,
      i: this.processId,
      s: this.objective.encode(),
    }
  }

  public static decode(state: BootstrapL8RoomProcessState): BootstrapL8RoomProcess {
    const objective = BootstrapL8RoomObjective.decode(state.s)
    return new BootstrapL8RoomProcess(state.l, state.i, objective)
  }

  public runOnTick(): void {
    const progress = this.objective.progress()
    switch (progress.objectProgressType) {
    case "in progress":
      processLog(this, `BootstrapL8RoomProcess ${this.processId} in progress: ${progress.value}`)
      return
    case "succeeded":
      processLog(this, `BootstrapL8RoomProcess ${this.processId} successfully level up to 8! ${progress.result.room.name}`)
      OperatingSystem.os.killProcess(this.processId)
      return
    case "failed":
      processLog(this, `BootstrapL8RoomProcess ${this.processId} failed with error ${progress.reason}`)
      OperatingSystem.os.killProcess(this.processId)
      return
    }
  }
}
