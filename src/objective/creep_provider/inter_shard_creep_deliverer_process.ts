import { Process, processLog, ProcessState } from "objective/process"
import { OperatingSystem } from "os/os"
import { InterShardCreepDelivererObjective, InterShardCreepDelivererObjectiveState } from "./inter_shard_creep_deliverer_objective"

export interface InterShardCreepDelivererProcessState extends ProcessState {
  /** objective state */
  s: InterShardCreepDelivererObjectiveState
}

// Game.io("launch InterShardCreepDelivererProcess portal_room_name=W50S30 parent_room_name=W51S29 shard_name=shard3 creep_type=armored_scout")
export class InterShardCreepDelivererProcess implements Process {
  public constructor(
    public readonly launchTime: number,
    public readonly processId: number,
    private readonly objective: InterShardCreepDelivererObjective,
  ) { }

  public encode(): InterShardCreepDelivererProcessState {
    return {
      t: "InterShardCreepDelivererProcess",
      l: this.launchTime,
      i: this.processId,
      s: this.objective.encode()
    }
  }

  public static decode(state: InterShardCreepDelivererProcessState): InterShardCreepDelivererProcess {
    const objective = InterShardCreepDelivererObjective.decode(state.s)
    return new InterShardCreepDelivererProcess(state.l, state.i, objective)
  }

  public processShortDescription(): string {
    return this.objective.destinationShardName
  }

  public runOnTick(): void {
    const progress = this.objective.progress()
    switch (progress.objectProgressType) {
    case "in progress":
      processLog(this, `In progress: ${progress.value}`)
      return
    case "succeeded":
      processLog(this, `Finish sending creep to ${this.objective.destinationShardName}`)
      OperatingSystem.os.killProcess(this.processId)
      return
    case "failed":
      processLog(this, `Failed with error ${progress.reason}`)
      OperatingSystem.os.killProcess(this.processId)
      return
    }
  }
}
