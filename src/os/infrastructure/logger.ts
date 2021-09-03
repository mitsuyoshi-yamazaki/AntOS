import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Process, ProcessId } from "process/process"
import { coloredText } from "utility/log"
import type { Timestamp } from "utility/timestamp"
import { ProcessRequestStore } from "os/process_request_store"

export function processLog(sender: Process, message: string): void {
  ProcessRequestStore.addLogRequest({
    processId: sender.processId,
    processType: sender.constructor.name,
    message: message
  })
}

export interface LoggerMemory {
  filteringProcessIds: ProcessId[]
}

const logInterval = 50

export class Logger {
  private lastLogs = new Map<ProcessId, { time: Timestamp, message: string }>()

  public run(): void {
    ProcessRequestStore.logRequests().forEach((requests, processId) => {
      if (this.shouldShowProcessLog(processId) !== true) {
        return
      }
      if (requests[0] == null) {
        return
      }
      this.show(processId, {
        processType: requests[0].processType,
        messages: requests.map(request => request.message),
      })
    })
  }

  private shouldShowProcessLog(processId: ProcessId): boolean {
    if (Memory.os.logger.filteringProcessIds.includes(processId) === true) {
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

  // // ---- MessageObserver ---- //
  // /**
  //  * @param message "<operation> <filter type> <filter value>"
  //  * - operation:
  //  *   - "add": add filter condition
  //  *   - "remove": remove filter condition
  //  * - filter type
  //  *   - "id": filter by process ID
  //  * - filter value
  //  *   - process ID
  //  * - example:
  //  *   - add id 12345
  //  *   - remove type TestProcess
  //  */
  // public didReceiveMessage(message: string): string {
  //   const components = message.split(" ")
  //   const operation = components[0]
  //   if (operation == null || !(isLoggerProcessMessageOperation(operation))) {
  //     return `Invalid operation ${operation}. Operation is either "add", "remove" or "clear"`
  //   }

  //   if (components.length < 3 && operation !== "clear") {
  //     return `Lack of components. Expected format: "&ltoperation&gt &ltfilter type&gt &ltfilter value&gt", raw message: ${message}`
  //   }

  //   const filterType = components[1]
  //   if (filterType == null || !(isLoggerProcessMessageFilterType(filterType))) {
  //     return `Invalid filter type ${filterType}. Filter type is either "id" (process ID) or "type" (process Type)`
  //   }

  //   switch (filterType) {
  //   case "id":
  //     return this.filterById(operation, components[2] ?? null)
  //   }
  // }

  // private filterById(operation: LoggerProcessMessageOperation, rawProcessId: string | null): string {
  //   switch (operation) {
  //   case "add": {
  //     if (rawProcessId == null) {
  //       return `Invalid process ID ${rawProcessId}`
  //     }
  //     const processId = parseInt(rawProcessId, 10)
  //     if (isNaN(processId)) {
  //       return `Invalid process ID ${rawProcessId}`
  //     }
  //     if (this.filter.processIds.includes(processId) === true) {
  //       return `Process ID ${processId} already added to the filter list`
  //     }
  //     this.filter.processIds.push(processId)
  //     return `Added ${processId}`
  //   }
  //   case "remove": {
  //     if (rawProcessId == null) {
  //       return `Invalid process ID ${rawProcessId}`
  //     }
  //     const processId = parseInt(rawProcessId, 10)
  //     if (isNaN(processId)) {
  //       return `Invalid process ID ${rawProcessId}`
  //     }
  //     const index = this.filter.processIds.indexOf(processId)
  //     if (index < 0) {
  //       return `Process ID ${processId} not in the filter list`
  //     }
  //     this.filter.processIds.splice(index, 1)
  //     return `Removed ${processId}`
  //   }
  //   case "clear":
  //     this.filter.processIds.splice(0, this.filter.processIds.length)
  //     return "Cleared all process IDs"
  //   }
  // }
}
