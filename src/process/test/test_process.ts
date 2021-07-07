import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { processLog } from "process/process_log"
import { ProcessState } from "process/process_state"

export interface TestProcessState extends ProcessState {
}

export class TestProcess implements Process, Procedural {
  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
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

  public static create(processId: ProcessId): TestProcess {
    return new TestProcess(Game.time, processId)
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
