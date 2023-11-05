import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "../../process_state"
import { ProcessDecoder } from "../../process_decoder"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { Reporter, ReportStore } from "./reporter"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ListArguments } from "shared/utility/argument_parser/list_argument_parser"

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
    private readonly reportTimeHour: number,
    private reportedDay: number,
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
      `time to next report: ${((new Date()).getHours() + 24 - this.reportTimeHour) % 24}`,
    ]

    return descriptions.join(", ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "report", "set", "settings", "stored_reports"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "report":
        return `Report at ${Game.time}:\n${this.getReport()}`

      case "set":
        return this.setReportSettings(components)

      case "settings":
        return this.getReportSettings()

      case "stored_reports":
        return this.getStoredReports()

      default:
        throw `Invalid command ${commandList}. see "help"`
      }
    } catch (error) {
      return `${ConsoleUtility.colored("[ERROR]", "error")} ${error}`
    }
  }

  /** @throws */
  private setReportSettings(args: string[]): string {
    const listArguments = new ListArguments(args)

    const setting = listArguments.stringInList(0, "setting", ["report_time_hour", "report_store_duration"]).parse()
    switch (setting) {
    case "report_time_hour": {
      const value = listArguments.int(1, "hour").parse({ min: 0, max: 23 })
      ReportStore.setReportTimeHour(value)
      return this.getReportSettings()
    }
    case "report_store_duration": {
      const value = listArguments.int(1, "duration").parse({ min: 1, max: 5 })
      ReportStore.setReportStoreDuration(value)
      return this.getReportSettings()
    }
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = setting
      return ""
    }
    }
  }

  private getReportSettings(): string {
    return `report_time_hour: ${ReportStore.getReportTimeHour()},\nreport_store_duration: ${ReportStore.getReportStoreDuration()}`
  }

  private getStoredReports(): string {
    const dailyReports = ReportStore.getDailyReports()
    if (dailyReports.length <= 0) {
      return "no reports"
    }
    return dailyReports.map(report => `${report.day}: ${report.reports.length} reports`).join("\n")
  }

  public runOnTick(): void {
    if (Game.time % 10 !== 0) {
      return
    }

    const now = new Date()
    if (now.getDay() === this.reportedDay) {
      return
    }

    if (now.getHours() !== this.reportTimeHour) {
      return
    }

    this.notifyReport()
    this.reportedDay = now.getDay()
  }

  private notifyReport(): void {
    const report = this.getReport()
    PrimitiveLogger.notice(report)
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
