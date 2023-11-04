import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"

ProcessDecoder.register("ReportProcess", state => {
  return ReportProcess.decode(state as ReportProcessState)
})

interface ReportProcessState extends ProcessState {
  readonly reportTimeHour: number
  readonly reportedDay: number
}

export class ReportProcess implements Process, Procedural {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly reportTimeHour: number,
    public readonly reportedDay: number,
  ) {
    this.identifier = `ReportProcess${launchTime}`
  }

  public encode(): ReportProcessState {
    return {
      t: "ReportProcess",
      l: this.launchTime,
      i: this.processId,
      reportTimeHour: this.reportTimeHour,
      reportedDay: this.reportedDay,
    }
  }

  public static decode(state: ReportProcessState): ReportProcess {
    return new ReportProcess(
      state.l,
      state.i,
      state.reportTimeHour ?? 0,
      state.reportedDay ?? 0
    )
  }

  public static create(processId: ProcessId): ReportProcess {
    return new ReportProcess(Game.time, processId, 0, 0)
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      `report hour: ${this.reportTimeHour}`,
      `time to next report: ${(new Date()).getHours() + 24 - this.reportTimeHour}`,
    ]

    return descriptions.join(", ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "test"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "test":
        return this.processShortDescription()

      default:
        throw `Invalid command ${commandList}. see "help"`
      }
    } catch (error) {
      return `${ConsoleUtility.colored("[ERROR]", "error")} ${error}`
    }
  }

  public runOnTick(): void {

  }

  private report(): void {

  }
}
