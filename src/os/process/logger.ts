import { MessageObserver } from "os/infrastructure/message_observer"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ProcessLog } from "os/infrastructure/runtime_memory"
import { OperatingSystem } from "os/os"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "process/process_state"

const logInterval = 50

export interface LoggerProcessState extends ProcessState {
  /** message filter (|| statement) */
  f: {
    /** filter by process ID */
    p: ProcessId[]

    /** filter by process type */
    t: string[]
  }
}

type LoggerProcessMessageOperation = "add" | "remove" | "clear"
function isLoggerProcessMessageOperation(arg: string): arg is LoggerProcessMessageOperation {
  return ["add", "remove", "clear"].includes(arg)
}

type LoggerProcessMessageFilterType = "id" | "type"
function isLoggerProcessMessageFilterType(arg: string): arg is LoggerProcessMessageFilterType {
  return ["id", "type"].includes(arg)
}

export class LoggerProcess implements Process, Procedural, MessageObserver {
  private lastLog: { time: number, message: string } = {
    time: 0,
    message: "",
  }

  public constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly filter: { processIds: ProcessId[], processTypes: string[] }
  ) {
  }

  public encode(): LoggerProcessState {
    return {
      t: "LoggerProcess",
      l: this.launchTime,
      i: this.processId,
      f: {
        p: this.filter.processIds,
        t: this.filter.processTypes,
      }
    }
  }

  public static decode(state: LoggerProcessState): LoggerProcess {
    const filter = {
      processIds: state.f.p,
      processTypes: state.f.t,
    }
    return new LoggerProcess(state.l, state.i, filter)
  }

  public processDescription(): string {
    return `- filters:\n  - process ID: ${this.filter.processIds}\n  - process types: ${this.filter.processTypes}`
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
  }

  private shouldShow(log: ProcessLog): boolean {
    if (this.filter.processIds.includes(log.processId)) {
      return true
    }
    if (this.filter.processTypes.includes(log.processType)) {
      return true
    }
    return false
  }

  private show(log: ProcessLog): void {
    const message = `${log.processId} ${log.processType}: ${log.message}`
    if (message === this.lastLog.message) {
      if (Game.time - this.lastLog.time < logInterval) {
        return
      }
    }
    this.lastLog = {
      time: Game.time,
      message,
    }
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
   *   - "type": filter by process type
   * - filter value
   *   - process ID or process type
   * - example:
   *   - add id 12345
   *   - remove type TestProcess
   */
  public didReceiveMessage(message: string): string {
    const components = message.split(" ")
    const operation = components[0]
    if (!(isLoggerProcessMessageOperation(operation))) {
      return `Invalid operation ${operation}. Operation is either "add", "remove" or "clear"`
    }

    if (components.length < 3 && operation !== "clear") {
      return `Lack of components. Expected format: "&ltoperation&gt &ltfilter type&gt &ltfilter value&gt", raw message: ${message}`
    }

    const filterType = components[1]
    if (!(isLoggerProcessMessageFilterType(filterType))) {
      return `Invalid filter type ${filterType}. Filter type is either "id" (process ID) or "type" (process Type)`
    }

    switch (filterType) {
    case "id":
      return this.filterById(operation, components[2])
    case "type":
      return this.filterByType(operation, components[2])
    }
  }

  private filterById(operation: LoggerProcessMessageOperation, rawProcessId: string): string {
    switch (operation) {
    case "add": {
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

  private filterByType(operation: LoggerProcessMessageOperation, typeIdentifier: string): string {
    switch (operation) {
    case "add":
      if (this.filter.processTypes.includes(typeIdentifier) === true) {
        return `Process type identifier ${typeIdentifier} already added to the filter list`
      }
      this.filter.processTypes.push(typeIdentifier)
      return `Added ${typeIdentifier}`
    case "remove": {
      const index = this.filter.processTypes.indexOf(typeIdentifier)
      if (index < 0) {
        return `Process type identifier ${typeIdentifier} not in the filter list`
      }
      this.filter.processTypes.splice(index, 1)
      return `Removed ${typeIdentifier}`
    }
    case "clear":
      this.filter.processTypes.splice(0, this.filter.processTypes.length)
      return "Cleared all process types"
    }
  }
}
