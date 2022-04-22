import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredText, describeTime } from "utility/log"
import { ProcessState } from "../process_state"
import { Timestamp } from "utility/timestamp"
import { ProcessDecoder } from "process/process_decoder"
import { MessageObserver } from "os/infrastructure/message_observer"
import { OperatingSystem } from "os/os"
import { ExecCommand } from "os/infrastructure/console_command/exec_command"
import { parseStandardIOCommand } from "os/infrastructure/standard_input"
import { processLog } from "os/infrastructure/logger"

ProcessDecoder.register("CronProcess", state => {
  return CronProcess.decode(state as CronProcessState)
})

export interface CronProcessState extends ProcessState {
  readonly nextRun: Timestamp
  readonly interval: Timestamp
  readonly rawCommand: string
  readonly stopReasons: string[]
}

export class CronProcess implements Process, Procedural, MessageObserver {
  public readonly taskIdentifier: string

  private readonly commandArgs: string[]
  private readonly commandOptions: Map<string, string>

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private nextRun: Timestamp,
    private readonly interval: Timestamp,
    private readonly rawCommand: string,
    private readonly stopReasons: string[]
  ) {
    this.taskIdentifier = `${this.constructor.name}_${this.processId}`

    const parseResult = parseStandardIOCommand(rawCommand)
    switch (parseResult.resultType) {
    case "failed":
      this.commandArgs = []
      this.commandOptions = new Map<string, string>()
      break
    case "succeeded": {
      const { options, args } = parseResult.value
      this.commandArgs = args
      this.commandOptions = options
      break
    }
    }
  }

  public encode(): CronProcessState {
    return {
      t: "CronProcess",
      l: this.launchTime,
      i: this.processId,
      nextRun: this.nextRun,
      interval: this.interval,
      rawCommand: this.rawCommand,
      stopReasons: this.stopReasons,
    }
  }

  public static decode(state: CronProcessState): CronProcess {
    return new CronProcess(state.l, state.i, state.nextRun, state.interval, state.rawCommand, state.stopReasons)
  }

  public static create(processId: ProcessId, interval: Timestamp, command: string): CronProcess {
    return new CronProcess(Game.time, processId, Game.time + 1, interval, command, [])
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      `${this.commandArgs[0]}`,
      `interval: ${this.interval}`,
      `next run: ${describeTime(this.nextRun - Game.time)}`
    ]
    if (this.stopReasons.length > 0) {
      descriptions.push(`stopped by: ${this.stopReasons.join(", ")}`)
    }

    return descriptions.join(", ")
  }

  public processDescription(): string {
    const processDescriptions: string[] = [
      `interval: ${this.interval}`,
      `next run: ${describeTime(this.nextRun - Game.time)}`,
    ]
    if (this.stopReasons.length > 0) {
      processDescriptions.push(`stopped by: ${this.stopReasons.join(", ")}`)
    }

    const descriptions: string[] = [
      processDescriptions.join(", "),
      this.rawCommand,
    ]
    return descriptions.join("\n")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "stop", "run_next_tick"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "stop":
        this.addStopReasons("manually")
        return "ok"

      case "run_next_tick":
        this.nextRun = Game.time + 1
        return "ok"

      default:
        throw `Invalid command ${commandList}. see "help"`
      }
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }

  public runOnTick(): void {
    if (this.stopReasons.length > 0) {
      return
    }
    if (this.nextRun > Game.time) {
      return
    }

    this.nextRun = Game.time + this.interval
    try {
      const execCommand = new ExecCommand(this.commandOptions, this.commandArgs, this.rawCommand)
      processLog(this, execCommand.run()) // TODO: コマンドの失敗を検知できない
    } catch (error) {
      this.addStopReasons(`error: ${error}`)
    }
  }

  private addStopReasons(reason: string): void {
    if (this.stopReasons.includes(reason) === true) {
      return
    }
    this.stopReasons.push(reason)
    OperatingSystem.os.suspendProcess(this.processId)
  }
}
