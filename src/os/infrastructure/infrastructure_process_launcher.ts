import { OperatingSystem } from "os/os"
import { LoggerProcess } from "os/process/logger"

export class InfrastructureProcessLauncher {
  public launchProcess(): void {
    const processInfo = OperatingSystem.os.listAllProcesses()
    const loggerExists = processInfo.some(info => info.type === "LoggerProcess")
    if (loggerExists !== true) {
      this.launchLoggerProcess()
    }
  }

  private launchLoggerProcess(): void {
    OperatingSystem.os.addProcess(processId => new LoggerProcess(Game.time, processId))
  }
}
