import { Messenger } from "./messenger"

/**
 * - RootProcessおよびInfrastructure Processesは状態をもたない
 *   - loggerは？
 * - [ ] console（標準入出力）の管理を行う
 */
export class RootProcess {
  public readonly shouldStore = false

  private readonly messenger = new Messenger()

  public constructor() {
  }

  public run(): void {
    this.messenger.run()
  }
}
