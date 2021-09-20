import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { processLog } from "os/infrastructure/logger"
import { ProcessState } from "process/process_state"
import { ProcessDecoder } from "process/process_decoder"
import { MessageObserver } from "os/infrastructure/message_observer"

ProcessDecoder.register("TestProcess", state => {
  return TestProcess.decode(state as TestProcessState)
})

ProcessDecoder.register("TestChildProcess", state => {
  return TestChildProcess.decode(state as TestChildProcessState)
})

export interface TestProcessState extends ProcessState {
  testMemory: string | null
}

export class TestProcess implements Process, Procedural, MessageObserver {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public testMemory: string | null,
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): TestProcessState {
    return {
      t: "TestProcess",
      l: this.launchTime,
      i: this.processId,
      testMemory: this.testMemory,
    }
  }

  public static decode(state: TestProcessState): TestProcess {
    return new TestProcess(state.l, state.i, state.testMemory)
  }

  public static create(processId: ProcessId): TestProcess {
    return new TestProcess(Game.time, processId, null)
  }

  public processDescription(): string {
    return `Test process at ${Game.time}`
  }

  public processShortDescription(): string {
    return this.testMemory ?? ""
  }

  public didReceiveMessage(message: string): string {
    this.testMemory = message
    return `"${message}" set`
  }

  public runBeforeTick(): void {
    processLog(this, `TestProcess.runBeforeTick() at ${Math.floor(Game.time / 20) * 20}, ${this.testMemory}`)
  }

  public runOnTick(): void {
    processLog(this, `TestProcess.run() at ${Math.floor(Game.time / 20) * 20}, ${this.testMemory}`)
  }
}

export interface TestChildProcessState extends ProcessState {
}

export class TestChildProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): TestChildProcessState {
    return {
      t: "TestChildProcess",
      l: this.launchTime,
      i: this.processId,
    }
  }

  public static decode(state: TestChildProcessState): TestChildProcess {
    return new TestChildProcess(state.l, state.i)
  }

  public static create(processId: ProcessId): TestChildProcess {
    return new TestChildProcess(Game.time, processId)
  }

  public processDescription(): string {
    return "child"
  }

  public runOnTick(): void {
    processLog(this, `Child log at ${Math.floor(Game.time / 20) * 20}`)
  }
}
