import { MessageObserver } from "os/infrastructure/message_observer"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ProcessLog } from "os/infrastructure/runtime_memory"
import { OperatingSystem } from "os/os"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "process/process_state"
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
    const logs = OperatingSystem.os.processLogs()
    logs.forEach(log => {
      if (this.shouldShow(log)) {
        this.show(log)
      }
    })
    OperatingSystem.os.clearProcessLogs()

    if (Game.time % 1511 === 13) {
      this.filter.processIds = this.filter.processIds.filter(processId => OperatingSystem.os.processOf(processId) != null)
    }
  }

  private shouldShow(log: ProcessLog): boolean {
    if (this.filter.processIds.includes(log.processId)) {
      return true
    }
    return false
  }

  private show(log: ProcessLog): void {
    const message = `${log.processId} ${log.processType}: ${log.message}`
    const lastLog = this.lastLogs.get(log.processId)
    if (lastLog != null && message === lastLog.message) {
      if (Game.time - lastLog.time < logInterval) {
        return
      }
    }
    this.lastLogs.set(log.processId, {
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
