import {
  Process,
} from "../process"
import { LauncherProcess } from "./launcher"

export const rootProcessId = 1
const launcherProcessId = 2

/**
 * - RootProcessおよびInfrastructure Processesは状態をもたない
 *   - loggerは？
 */
export class RootProcess implements Process {
  public readonly processId = rootProcessId
  public readonly shouldStore = false

  private readonly launcherProcess = new LauncherProcess(launcherProcessId)

  public constructor() {
  }

  public infrastructureProcesses(): Process[] {
    return [
      this.launcherProcess,
    ]
  }

  public run(): void {
    this.launcherProcess.run()
  }
}
