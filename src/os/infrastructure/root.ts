import { ErrorMapper } from "error_mapper/ErrorMapper"
import { InfrastructureProcessLauncher } from "./infrastructure_process_launcher"

export class RootProcess {
  private readonly processLauncher = new InfrastructureProcessLauncher()

  public constructor() {
  }

  public setup(): void {
    ErrorMapper.wrapLoop(() => {
      this.processLauncher.launchProcess()
    }, "RootProcess.processLauncher.launchProcess()")()
  }

  public run(): void {
  }
}
