import {
  Process,
} from "../../process/process"
import { LauncherProcess } from "./launcher"
import { MessengerProcess } from "./messenger"
import { QuitterProcess } from "./quitter"

export const rootProcessId = 1
const launcherProcessId = 2
const quitterProcessId = 3
const messengerProcessId = 4

export const maxInfrastructureProcessId = 1000

/**
 * - RootProcessおよびInfrastructure Processesは状態をもたない
 *   - loggerは？
 * - [ ] console（標準入出力）の管理を行う
 */
export class RootProcess implements Process {
  public readonly processId = rootProcessId
  public readonly shouldStore = false

  private readonly launcherProcess = new LauncherProcess(launcherProcessId)
  private readonly quitterProcess = new QuitterProcess(quitterProcessId)
  private readonly messengerProcess = new MessengerProcess(messengerProcessId)

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
    this.messengerProcess.run()
  }
}
