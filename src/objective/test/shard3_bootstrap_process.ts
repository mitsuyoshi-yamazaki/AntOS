import { Procedural } from "objective/procedural"
import { Process, ProcessState } from "objective/process"

export interface Shard3BootstrapProcessState extends ProcessState {

}

// Game.io("exec PlaceOldRoomPlan room_name=W51S29 layout_name=mark06 x=15 y=15")
export class Shard3BootstrapProcess implements Process, Procedural {
  public constructor(
    public readonly launchTime: number,
    public readonly processId: number,
  ) { }

  public encode(): Shard3BootstrapProcessState {
    return {
      t: "Shard3BootstrapProcess",
      l: this.launchTime,
      i: this.processId,
    }
  }

  public static decode(state: Shard3BootstrapProcessState): Shard3BootstrapProcess {
    return new Shard3BootstrapProcess(state.l, state.i)
  }

  public processDescription(): string {
    return `Test process at ${Game.time}`
  }

  public runOnTick(): void {
    for (const creepName in Game.creeps) {
      const creep = Game.creeps[creepName]
      this.work(creep)
    }
  }

  private work(creep: Creep): void {
    if (creep.room.name !== "W51S29") {
      creep.moveToRoom("W51S29")
      return
    }
  }
}
