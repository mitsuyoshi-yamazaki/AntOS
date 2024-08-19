import { Process, ProcessDependencies, ProcessId, ReadonlySharedMemory, processDefaultIdentifier } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { V3BridgeDriverProcessApi } from "./v3_bridge_driver_process"
import { Timestamp } from "shared/utility/timestamp"
import { SystemCalls } from "os_v5/system_calls/interface"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { Command, runCommands } from "os_v5/standard_io/command"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"

type Dependency = V3BridgeDriverProcessApi

const changeTarget = [
  "name",
  "interval",
  "duration",
] as const
type ChangeTarget = typeof changeTarget[number]
const isChangeTarget = (value: string): value is ChangeTarget => (changeTarget as Readonly<string[]>).includes(value)


type V3ProcessLauncherProcessState = {
  readonly n: string      /// Name
  readonly m: string      /// V3 message
  readonly in: Timestamp  /// Interval
  readonly r: Timestamp   /// Next run
  readonly u: Timestamp   /// Until
}

ProcessDecoder.register("V3ProcessLauncherProcess", (processId: V3ProcessLauncherProcessId, state: V3ProcessLauncherProcessState) => V3ProcessLauncherProcess.decode(processId, state))

export type V3ProcessLauncherProcessId = ProcessId<Dependency, string, void, V3ProcessLauncherProcessState, V3ProcessLauncherProcess>


export class V3ProcessLauncherProcess extends Process<Dependency, string, void, V3ProcessLauncherProcessState, V3ProcessLauncherProcess> {
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "V3BridgeDriverProcess", identifier: processDefaultIdentifier},
    ],
  }

  public get identifier(): string {
    return this.name
  }

  private constructor(
    public readonly processId: V3ProcessLauncherProcessId,
    private name: string,
    private readonly v3Message: string,
    private interval: Timestamp,
    private nextRun: Timestamp,
    private until: Timestamp,
  ) {
    super()
  }

  public encode(): V3ProcessLauncherProcessState {
    return {
      n: this.name,
      m: this.v3Message,
      in: this.interval,
      r: this.nextRun,
      u: this.until,
    }
  }

  public static decode(processId: V3ProcessLauncherProcessId, state: V3ProcessLauncherProcessState): V3ProcessLauncherProcess {
    return new V3ProcessLauncherProcess(processId, state.n, state.m, state.in, state.r, state.u)
  }

  public static create(processId: V3ProcessLauncherProcessId, name: string, v3Message: string, interval: Timestamp, duration: Timestamp): V3ProcessLauncherProcess {
    return new V3ProcessLauncherProcess(processId, name, v3Message, interval, Game.time, Game.time + duration)
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    const descriptions: string[] = [
      this.name,
      `next run in: ${this.nextRun - Game.time}`,
      `in ${ConsoleUtility.shortenedNumber(this.until - Game.time)}`,
    ]

    return descriptions.join(", ")
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }


  /** @throws */
  public didReceiveMessage(argumentParser: ArgumentParser): string {
    return runCommands(argumentParser, [
      this.statusCommand,
      this.changeCommand,
    ])
  }

  public run(dependency: Dependency): void {
    if (Game.time >= this.until) {
      SystemCalls.processManager.suspend(this)
      return
    }

    if (Game.time < this.nextRun) {
      return
    }

    this.nextRun = Game.time + this.interval

    const result = dependency.sendMessageToV3(this.v3Message)
    SystemCalls.logger.log(this, `\nMessage: '${this.v3Message}'\n${result}`)
  }


  // ---- Command Runner ---- //
  private readonly statusCommand: Command = {
    command: "status",
    help: (): string => "status",

    /** @throws */
    run: (): string => {
      const statuses: string[] = [
        `interval: ${this.interval}`,
        `duration: ${this.until - Game.time}`,
        `next run: ${this.nextRun - Game.time}`,
        "message:",
        this.v3Message,
      ]

      return statuses.join("\n")
    }
  }

  private readonly changeCommand: Command = {
    command: "change",
    help: (): string => "change {change target} {...args}",

    /** @throws */
    run: (argumentParser: ArgumentParser): string => {
      const changeTarget = argumentParser.typedString([0, "change target"], "ChangeTarget", isChangeTarget).parse()

      switch (changeTarget) {
      case "name": {
        const oldValue = this.name
        this.name = argumentParser.string([1, "name"]).parse()

        return `Changed name ${oldValue} =&gt ${this.name}`
      }

      case "interval": {
        const oldValue = this.interval
        this.interval = argumentParser.int([1, "interval"]).parse({min: 10})

        return `Changed interval ${oldValue} =&gt ${this.interval}`
      }

      case "duration": {
        const oldValue = this.until - Game.time
        const duration = argumentParser.int([1, "duration"]).parse({ min: 10 })
        this.until = Game.time + duration

        return `Changed name ${oldValue} =&gt ${duration}`
      }

      default: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _: never = changeTarget
        throw `Unexpected target ${changeTarget}`
      }
      }
    }
  }
}
