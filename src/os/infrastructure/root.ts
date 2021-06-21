import { LauncherProcess } from "./launcher"
import { MessengerProcess } from "./messenger"
import { QuitterProcess } from "./quitter"

/**
 * - RootProcessおよびInfrastructure Processesは状態をもたない
 *   - loggerは？
 * - [ ] console（標準入出力）の管理を行う
 */
export class RootProcess {
  public readonly shouldStore = false

  private readonly launcherProcess = new LauncherProcess()
  private readonly quitterProcess = new QuitterProcess()
  private readonly messengerProcess = new MessengerProcess()

  public constructor() {
  }

  public run(): void {
    this.launcherProcess.run()
    this.quitterProcess.run()
    this.messengerProcess.run()
  }
}
