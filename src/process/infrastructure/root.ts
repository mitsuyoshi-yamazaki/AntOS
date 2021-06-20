import {
  Process,
} from "../process"
import { LauncherProcess } from "./launcher"
import { QuitterProcess } from "./quitter"

export const rootProcessId = 1
const launcherProcessId = 2
const quitterProcessId = 3

export const maxInfrastructureProcessId = 1000

/**
 * - RootProcessおよびInfrastructure Processesは状態をもたない
 *   - loggerは？
 */
export class RootProcess implements Process {
  public readonly processId = rootProcessId
  public readonly shouldStore = false

  private readonly launcherProcess = new LauncherProcess(launcherProcessId)
  private readonly quitterProcess = new QuitterProcess(quitterProcessId)

  public constructor() {
  }

  public infrastructureProcesses(): Process[] {
    return [
      this.launcherProcess,
    ]
  }

  public run(): void {
    this.launcherProcess.run()
    this.quitterProcess.run()
  }
}
