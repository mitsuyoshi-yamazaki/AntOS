import { AnyDriver, DriverSet } from "./driver"
import { AnyProcessDependency } from "./process_dependency";
import { SystemCall } from "./system_call"

declare namespace Tag {
  const OpaqueTagSymbol: unique symbol

  class OpaqueTag<T> {
    private [OpaqueTagSymbol]: T
  }
}
export type ProcessId<T extends ProcessInterface> = string & Tag.OpaqueTag<T>;

interface ProcessInterface {
  readonly processId: ProcessId<this>
}

// ProcessのdependencyはDriverだけではなく親Processが渡す引数が入る可能性がある
// 親子関係ではなく依存関係とする
// → 依存先がなくなった場合はreparenting
export abstract class Process<D extends (AnyDriver | never), Dependencies extends AnyProcessDependency> implements ProcessInterface {
  public abstract readonly processId: ProcessId<this>
  public abstract readonly dependencyTypes: Dependencies["typeSpecifier"]

  public constructor(
    protected readonly systemCall: SystemCall,
    protected readonly drivers: DriverSet<D>,
    protected readonly processManager: ProcessManagerInterface,
  ) {}

  public abstract run(): void
}

export type AnyProcess = Process<AnyDriver>

export interface ProcessManagerInterface {
  addProcess(process: Process<AnyDriver>): void
  getProcess<P extends Process<AnyDriver>>(processId: ProcessId<P>): P | null

  /** @throws */
  suspendProcess(process: Process<AnyDriver>): void

  /** @throws */
  killProcess(process: Process<AnyDriver>): void
}
