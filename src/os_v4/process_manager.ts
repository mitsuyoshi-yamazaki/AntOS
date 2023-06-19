import { AnyDriver } from "./driver"
import { Process, ProcessId } from "./process"

// ProcessからProcessManagerを呼び出す経路が循環しないようにする
export class ProcessManager<D extends AnyDriver> {
  private processes: Process<D>[] = []

  public load(): void {
    this.restoreProcesses()
  }

  public startOfTick(): void {
  }

  public endOfTick(): void {
    this.storeProcesses()
  }

  public addProcess(process: Process<D>): void {
  }

  public getProcess<P extends Process<D>>(processId: ProcessId<P>): P | null {
    return null // TODO:
  }

  private restoreProcesses(): void {
  }

  private storeProcesses(): void {
  }
}
