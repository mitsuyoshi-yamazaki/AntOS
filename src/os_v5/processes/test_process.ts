import { Process, ProcessDependencies, ProcessId } from "../process/process"
import { State } from "../utility/codable"
import { Timestamp } from "shared/utility/timestamp"
import { shortenedNumber } from "shared/utility/console_utility"

interface TestProcessState extends State {
  // t: "a"
}

export type TestProcessId = ProcessId<void, TestProcess>

export class TestProcess implements Process<void, TestProcess> {
  public dependencies: ProcessDependencies = {
    driverNames: [],
    processes: [],
  }

  private constructor(
    public readonly processId: TestProcessId,
    public readonly launchTime: Timestamp,
  ) {
  }

  public encode(): TestProcessState {
    throw "not implemented yet"
  }

  public static decode(): TestProcess {
    throw "not implemented yet"
  }

  public static create(processId: TestProcessId): TestProcess {
    return new TestProcess(processId, Game.time)
  }

  public getDependentData(): void {}

  public shortDescription(): string {
    return `launched at ${this.launchTime} (${shortenedNumber(Game.time - this.launchTime)})`
  }

  public runtimeDescription(): string {
    return this.shortDescription()
  }

  public run(): void {
    if (Game.time % 10 !== 0) {
      return
    }
    console.log(this.runtimeDescription())
  }
}
