import { Process, ProcessState } from "./process"

export interface TestProcessState extends ProcessState {
}

export class TestProcess implements Process {
  public constructor(
    public readonly launchTime: number,
    public readonly processId: number,
  ) {}

  public encode(): ProcessState {
    return {
      t: "TestProcess",
      l: this.launchTime,
      i: this.processId,
    }
  }

  public static decode(state: TestProcessState): TestProcess | null {
    return new TestProcess(state.l, state.i)
  }

  public processDescription(): string {
    return `Test process at ${Game.time}`
  }
}
