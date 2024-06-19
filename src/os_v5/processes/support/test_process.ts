import { Process, ProcessDependencies, ProcessId } from "../../process/process"
import { Timestamp } from "shared/utility/timestamp"
import { shortenedNumber } from "shared/utility/console_utility"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"

type TestProcessState = {
  readonly l: Timestamp
  readonly id: string
}

ProcessDecoder.register("TestProcess", (processId: TestProcessId, state: TestProcessState) => TestProcess.decode(processId, state))

export type TestProcessId = ProcessId<void, string, void, TestProcessState, TestProcess>


export class TestProcess extends Process<void, string, void, TestProcessState, TestProcess> {
  public readonly dependencies: ProcessDependencies = {
    processes: [],
  }

  private constructor(
    public readonly processId: TestProcessId,
    public readonly launchTime: Timestamp,
    public readonly identifier: string,
  ) {
    super()
  }

  public encode(): TestProcessState {
    return {
      l: this.launchTime,
      id: this.identifier,
    }
  }

  public static decode(processId: TestProcessId, state: TestProcessState): TestProcess {
    return new TestProcess(processId, state.l, state.id)
  }

  public static create(processId: TestProcessId, identifier: string): TestProcess {
    return new TestProcess(processId, Game.time, identifier)
  }

  public getDependentData(): void {}

  public staticDescription(): string {
    return `launched at ${this.launchTime} (${shortenedNumber(Game.time - this.launchTime)})`
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(): void {
    if (Game.time % 10 !== 0) {
      return
    }
    console.log(`${this.constructor.name} ${this.runtimeDescription()}`)

    // new RoomPosition(0, 0, "a")
    // throw "hoge"
  }
}
