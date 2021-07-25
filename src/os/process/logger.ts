import { MessageObserver } from "os/infrastructure/message_observer"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ProcessLog } from "os/infrastructure/runtime_memory"
import { OperatingSystem } from "os/os"
import { ProcessInfo } from "os/os_process_info"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "process/process_state"
import { coloredText } from "utility/log"
import type { Timestamp } from "utility/timestamp"

const logInterval = 50

export interface LoggerProcessState extends ProcessState {
  /** message filter */
  f: {
    /** filter by process ID */
    p: ProcessId[]
  }
}

type LoggerProcessMessageOperation = "add" | "remove" | "clear"
function isLoggerProcessMessageOperation(arg: string): arg is LoggerProcessMessageOperation {
  return ["add", "remove", "clear"].includes(arg)
}

type LoggerProcessMessageFilterType = "id"
function isLoggerProcessMessageFilterType(arg: string): arg is LoggerProcessMessageFilterType {
  return ["id"].includes(arg)
}

export class LoggerProcess implements Process, Procedural, MessageObserver {
  private lastLogs = new Map<ProcessId, { time: Timestamp, message: string }>()

  public constructor(
    public readonly launchTime: Timestamp,
    public readonly processId: ProcessId,
    private readonly filter: { processIds: ProcessId[] }
  ) {
  }

  public encode(): LoggerProcessState {
    return {
      t: "LoggerProcess",
      l: this.launchTime,
      i: this.processId,
      f: {
        p: this.filter.processIds,
      }
    }
  }

  public static decode(state: LoggerProcessState): LoggerProcess {
    const filter = {
      processIds: state.f.p,
    }
    return new LoggerProcess(state.l, state.i, filter)
  }

  public processDescription(): string {
    return `- filters:\n  - process ID: ${this.filter.processIds}`
  }

  // ---- Procedural ---- //
  public runOnTick(): void {
    const processLogs = new Map<ProcessId, { processType: string, messages: string[] }>()
    OperatingSystem.os.processLogs().forEach(log => {
      const logInfo = ((): { processType: string, messages: string[] } => {
        const stored = processLogs.get(log.processId)
        if (stored != null) {
          return stored
        }
        const newInfo = {
          processType: log.processType,
          messages: [],
        }
        processLogs.set(log.processId, newInfo)
        return newInfo
      })()
      logInfo.messages.push(log.message)
    })
    processLogs.forEach((logInfo, processId) => {
      if (this.shouldShowProcessLog(processId)) {
        this.show(processId, logInfo)
      }
    })
    OperatingSystem.os.clearProcessLogs()

    if (Game.time % 1511 === 13) {
      this.filter.processIds = this.filter.processIds.filter(processId => OperatingSystem.os.processOf(processId) != null)
    }
  }

  private shouldShowProcessLog(processId: ProcessId): boolean {
    if (this.filter.processIds.includes(processId)) {
      return true
    }
    return false
  }

  private show(processId: ProcessId, logInfo: { processType: string, messages: string[] }): void {
    const message = ((): string => {
      if (logInfo.messages.length > 1) {
        return `${processId} ${logInfo.processType}${coloredText(":", "info")} \n  ${logInfo.messages.join("\n  ")}`
      }
      return `${processId} ${logInfo.processType}${coloredText(":", "info")} ${logInfo.messages[0]}`
    })()
    const lastLog = this.lastLogs.get(processId)
    if (lastLog != null && message === lastLog.message) {
      if (Game.time - lastLog.time < logInterval) {
        return
      }
    }
    this.lastLogs.set(processId, {
      time: Game.time,
      message,
    })
    PrimitiveLogger.log(message)
  }

  // ---- MessageObserver ---- //
  /**
   * @param message "<operation> <filter type> <filter value>"
   * - operation:
   *   - "add": add filter condition
   *   - "remove": remove filter condition
   * - filter type
   *   - "id": filter by process ID
   * - filter value
   *   - process ID
   * - example:
   *   - add id 12345
   *   - remove type TestProcess
   */
  public didReceiveMessage(message: string): string {
    const components = message.split(" ")
    const operation = components[0]
    if (operation == null || !(isLoggerProcessMessageOperation(operation))) {
      return `Invalid operation ${operation}. Operation is either "add", "remove" or "clear"`
    }

    if (components.length < 3 && operation !== "clear") {
      return `Lack of components. Expected format: "&ltoperation&gt &ltfilter type&gt &ltfilter value&gt", raw message: ${message}`
    }

    const filterType = components[1]
    if (filterType == null || !(isLoggerProcessMessageFilterType(filterType))) {
      return `Invalid filter type ${filterType}. Filter type is either "id" (process ID) or "type" (process Type)`
    }

    switch (filterType) {
    case "id":
      return this.filterById(operation, components[2] ?? null)
    }
  }

  private filterById(operation: LoggerProcessMessageOperation, rawProcessId: string | null): string {
    switch (operation) {
    case "add": {
      if (rawProcessId == null) {
        return `Invalid process ID ${rawProcessId}`
      }
      const processId = parseInt(rawProcessId, 10)
      if (isNaN(processId)) {
        return `Invalid process ID ${rawProcessId}`
      }
      if (this.filter.processIds.includes(processId) === true) {
        return `Process ID ${processId} already added to the filter list`
      }
      this.filter.processIds.push(processId)
      return `Added ${processId}`
    }
    case "remove": {
      if (rawProcessId == null) {
        return `Invalid process ID ${rawProcessId}`
      }
      const processId = parseInt(rawProcessId, 10)
      if (isNaN(processId)) {
        return `Invalid process ID ${rawProcessId}`
      }
      const index = this.filter.processIds.indexOf(processId)
      if (index < 0) {
        return `Process ID ${processId} not in the filter list`
      }
      this.filter.processIds.splice(index, 1)
      return `Removed ${processId}`
    }
    case "clear":
      this.filter.processIds.splice(0, this.filter.processIds.length)
      return "Cleared all process IDs"
    }
  }
}
