import { Process, processDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "os_v5/process/process"
import type { Timestamp } from "shared/utility/timestamp"
import { shortenedNumber } from "shared/utility/console_utility"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { SystemCalls } from "os_v5/system_calls/interface"
import { deferredTaskPriority, DeferredTaskResult } from "os_v5/system_calls/depended_system_calls/deferred_task"
import { ObjectParserCommand, runCommandsWith } from "os_v5/standard_io/command"
import { NotificationReceiver } from "os_v5/system_calls/depended_system_calls/notification_manager"
import { Notification, notificationManagerTestNotification,  } from "os_v5/system_calls/depended_system_calls/notification_manager_types"
import { processManagerProcessDidKillNotification, processManagerProcessDidLaunchNotification } from "os_v5/system_calls/process_manager/process_manager_notification"
import { strictEntries } from "shared/utility/strict_entries"
import { InterShardCommunicatorProcessApi } from "os_v5/processes/game_object_management/shard/inter_shard_communicator_process"


const deferredTaskTypes = ["loop_task"] as const
type DeferredTaskTypes = typeof deferredTaskTypes[number]


type Dependency = InterShardCommunicatorProcessApi
type Command = ObjectParserCommand<Dependency, string>


type TestProcessState = {
  readonly l: Timestamp
  readonly id: string
}

ProcessDecoder.register("TestProcess", (processId: TestProcessId, state: TestProcessState) => TestProcess.decode(processId, state))

export type TestProcessId = ProcessId<Dependency, string, void, TestProcessState, TestProcess>


export class TestProcess extends Process<Dependency, string, void, TestProcessState, TestProcess> implements NotificationReceiver {
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "InterShardCommunicatorProcess", identifier: processDefaultIdentifier },
    ],
  }

  private constructor(
    public readonly processId: TestProcessId,
    public readonly launchTime: Timestamp,
    public readonly identifier: string,
  ) {
    super()

    SystemCalls.notificationManager.addObserver(this, processManagerProcessDidLaunchNotification)
    SystemCalls.notificationManager.addObserver(this, processManagerProcessDidKillNotification)
    SystemCalls.notificationManager.addObserver(this, notificationManagerTestNotification)
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

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    return `launched at ${this.launchTime} (${shortenedNumber(Game.time - this.launchTime)})`
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  /** @throws */
  public didReceiveMessage(argumentParser: ArgumentParser, dependency: Dependency): string {
    return runCommandsWith<Dependency, string>(argumentParser, dependency, [
      this.addDeferredTaskCommand,
      this.testInterShardCommunicationCommand,
    ])
  }

  public run(): void {
    if (Game.time % 10 !== 0) {
      return
    }
    SystemCalls.logger.log(this, this.runtimeDescription())
  }


  // ---- Event Receiver ---- //
  public didReceiveNotification(notification: Notification): void {
    SystemCalls.logger.log(this, `Did receive notification: \n${this.describeNotification(notification)}`)
  }

  private describeNotification(notification: Notification): string {
    return strictEntries(notification).map(([key, value]) => `- ${key}: ${value}`).join("\n")
  }

  public didFinishDeferredTask<TaskType extends string, T>(taskResult: DeferredTaskResult<TaskType, T>): void {
    switch (taskResult.result.case) {
    case "succeeded":
      SystemCalls.logger.log(this, `Deferred task ${taskResult.taskType} (${taskResult.id}) finished. Result: ${taskResult.result.value}`, true)
      break

    case "failed":
      SystemCalls.logger.log(this, `Deferred task ${taskResult.taskType} (${taskResult.id}) failed with error: ${taskResult.result.error.case}`, true)

      /**
[2:02:23 AM][shard2](p) TestProcess[Test] Deferred task loop_task (v) failed with error: server restarted
[2:02:23 AM][shard2]DeferredTaskManager Task loop_task for p was canceled by server restart
*/
      break
    }
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
          SystemCalls.logger.log(this, `Deferred task ${"loop_task"} started`, true)

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

  // InterShard
  private readonly testInterShardCommunicationCommand: Command = {
    command: "test_inter_shard_communication",
    help: (): string => "test_inter_shard_communication {test subject} {...args}",

    /** @throws */
    run: (argumentParser: ArgumentParser, dependency: Dependency): string => {
      return runCommandsWith<Dependency, string>(argumentParser, dependency, [
      ])
    }
  }

  private readonly interShardCommunicationReadCommand: Command = {
    command: "read",
    help: (): string => "read {shard name}",

    /** @throws */
    run: (argumentParser: ArgumentParser, dependency: Dependency): string => {
      const claimedRooms = dependency.getClaimedRooms()
      const results: string[] = [
        `Claimed rooms in ${claimedRooms.size} shards:`,
      ]

      claimedRooms.forEach((roomNames, shardName) => {
        results.push(`- ${shardName}:`)
        results.push(`  - ${roomNames}`)
      })

      return results.join("\n")
    }
  }
}
