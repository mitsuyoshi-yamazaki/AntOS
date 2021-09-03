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
}
