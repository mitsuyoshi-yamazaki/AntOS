import { Process, ProcessDependencies, ProcessId } from "../../../process/process"
import type { Timestamp } from "shared/utility/timestamp"
import { shortenedNumber } from "shared/utility/console_utility"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { SystemCalls } from "os_v5/system_calls/interface"
import { deferredTaskPriority, DeferredTaskResult } from "os_v5/system_calls/depended_system_calls/deferred_task"
import { Command, runCommands } from "os_v5/standard_io/command"


const deferredTaskTypes = ["loop_task"] as const
type DeferredTaskTypes = typeof deferredTaskTypes[number]


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

  /** @throws */
  public didReceiveMessage(argumentParser: ArgumentParser): string {
    return runCommands(argumentParser, [
      this.addDeferredTaskCommand,
    ])
  }

  public run(): void {
    if (Game.time % 10 !== 0) {
      return
    }
    this.log(this.runtimeDescription())

    // new RoomPosition(0, 0, "a")
    // throw "hoge"
  }

  public didFinishDeferredTask<TaskType extends string, T>(taskResult: DeferredTaskResult<TaskType, T>): void {
    switch (taskResult.result.case) {
    case "succeeded":
      this.log(`Deferred task ${taskResult.taskType} (${taskResult.id}) finished. Result: ${taskResult.result.value}`)
      break

    case "failed":
      this.log(`Deferred task ${taskResult.taskType} (${taskResult.id}) failed with error: ${taskResult.result.error.case}`)

      /**
[2:02:23 AM][shard2](p) TestProcess[Test] Deferred task loop_task (v) failed with error: server restarted
[2:02:23 AM][shard2]DeferredTaskManager Task loop_task for p was canceled by server restart
*/
      break
    }
  }

  private log(message: string): void {
    console.log(`${this} ${message}`)
  }


  // ---- Command Runner ---- //
  private readonly addDeferredTaskCommand: Command = {
    command: "add_deferred_task",
    help: (): string => "add_deferred_task loop_count={calculation loop count}",

    /** @throws */
    run: (argumentParser: ArgumentParser): string => {
      const loopCount = argumentParser.int("loop_count").parse({ min: 0 })

      const taskId = SystemCalls.deferredTaskManager.register<DeferredTaskTypes, number>(
        this.processId,
        "loop_task",
        (): number => {
          this.log(`Deferred task ${"loop_task"} started`)

          let result = 0
          for (let i = 0; i < loopCount; i += 1) {
            result += i
          }
          return result
        },
        {
          priority: deferredTaskPriority.low,
        },
      )

      return `Registered diferred task ${"loop_task"} (${taskId})`
    }
  }
}
