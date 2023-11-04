import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "../../process_state"
import { ProcessDecoder } from "../../process_decoder"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { ReportCollector, Reporter } from "./reporter"

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
    const commandList = ["help", "report"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "report":
        return this.getReport()

      default:
        throw `Invalid command ${commandList}. see "help"`
      }
    } catch (error) {
      return `${ConsoleUtility.colored("[ERROR]", "error")} ${error}`
    }
  }

  public runOnTick(): void {

  }

  private notifyReport(): void {
    const report = this.getReport()
    ReportCollector.clearReport()

    // TODO:
  }

  private getReport(): string {
    const report = ((): string => {
      const eventReports = Reporter.createEventReports()
      const statusReportDetail = (3 - eventReports[0]) as 0 | 1 | 2 | 3
      if (statusReportDetail === 0) {
        return eventReports[1].join("\n")
      }

      const statusReports = Reporter.createStatusReports(statusReportDetail)
      return [
        ...eventReports[1],
        ...statusReports,
      ].join("\n")
    })()

    return report
  }
}
