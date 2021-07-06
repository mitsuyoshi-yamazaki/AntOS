import { Procedural } from "process/procedural"
import { Process, processLog, ProcessState } from "process/process"

export interface TestProcessState extends ProcessState {
}

export class TestProcess implements Process, Procedural {
  public constructor(
    public readonly launchTime: number,
    public readonly processId: number,
  ) {}

  public encode(): TestProcessState {
    return {
      t: "TestProcess",
      l: this.launchTime,
      i: this.processId,
    }
  }

  public static decode(state: TestProcessState): TestProcess {
    return new TestProcess(state.l, state.i)
  }

  public processDescription(): string {
    return `Test process at ${Game.time}`
  }

  public runOnTick(): void {
    if (Game.time % 13 === 7) {
      processLog(this, `Test log at ${Game.time}`)
    }
  }
}
