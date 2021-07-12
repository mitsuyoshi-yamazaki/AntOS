import { LoggerProcess } from "os/process/logger"
import type { Process } from "process/process"
import type { ProcessLauncher } from "os/os_process_launcher"

export class InfrastructureProcessLauncher {
  public launchProcess(processList: Process[], processLauncher: ProcessLauncher): void {
    const loggerExists = processList.some(process => process instanceof LoggerProcess)
    if (loggerExists !== true) {
      this.launchLoggerProcess(processLauncher)
    }
  }

  private launchLoggerProcess(processLauncher: ProcessLauncher): void {
    const emptyFilter = {
      processIds: [],
      processTypes: [],
    }
    processLauncher(processId => new LoggerProcess(Game.time, processId, emptyFilter))
  }
}
