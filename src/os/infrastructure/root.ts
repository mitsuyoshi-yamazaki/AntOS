import { ProcessLauncher } from "./process_launcher"
import { Messenger } from "./messenger"
import { ProcessQuitter } from "./process_quitter"

/**
 * - RootProcessおよびInfrastructure Processesは状態をもたない
 *   - loggerは？
 * - [ ] console（標準入出力）の管理を行う
 */
export class RootProcess {
  public readonly shouldStore = false

  private readonly processLauncher = new ProcessLauncher()
  private readonly processQuitter = new ProcessQuitter()
  private readonly messenger = new Messenger()

  public constructor() {
  }

  public run(): void {
    this.processLauncher.run()
    this.processQuitter.run()
    this.messenger.run()
  }
}
