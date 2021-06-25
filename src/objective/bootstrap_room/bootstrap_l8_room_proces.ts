import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { OperatingSystem } from "os/os"
import { Procedural } from "objective/procedural"
import { Process, ProcessId, processLog, ProcessState } from "objective/process"
import { BootstrapL8RoomObjective, BootstrapL8RoomObjectiveState } from "./bootstarp_l8_room_objective"

export interface BootstrapL8RoomProcessState extends ProcessState {
  /** objective state */
  s: BootstrapL8RoomObjectiveState
}

/**
 * Game.io("launch BootstrapL8RoomProcess target_room_name=W53S7 parent_room_name=W54S7 -l")
 */
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
      if (progress.value !== "not implemented yet") {
        processLog(this, `BootstrapL8RoomProcess ${this.processId} in progress: ${progress.value}`)
      }
      return
    case "succeeded":
      processLog(this, `BootstrapL8RoomProcess ${this.processId} successfully level up to 8! ${progress.result.room.name}`)
      OperatingSystem.os.killProcess(this.processId)
      return
    case "failed":
      PrimitiveLogger.log(`BootstrapL8RoomProcess ${this.processId} failed with error: ${progress.reason}`)
      OperatingSystem.os.killProcess(this.processId)
      return
    }
  }
}
