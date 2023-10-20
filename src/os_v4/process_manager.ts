import { AnyDriver } from "./driver"
import { Process, ProcessId, ProcessManagerInterface } from "./process"



export class ProcessManager<D extends AnyDriver> implements ProcessManagerInterface {
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

  /** @throws */
  public suspendProcess(process: Process<AnyDriver>): void {
  }

  /** @throws */
  public killProcess(process: Process<AnyDriver>): void {
  }

  private restoreProcesses(): void {
  }

  private storeProcesses(): void {
  }
}
