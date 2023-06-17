import { AnyDriver, DriverSet } from "./driver"
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
// それをProcessManagerはどう平準化するか？
export abstract class Process<D extends (AnyDriver | never)> implements ProcessInterface {
  public abstract readonly processId: ProcessId<this>

  public constructor(
    private readonly systemCall: SystemCall,
    private readonly drivers: DriverSet<D>,
  ) {}

  public abstract run(): void
}

export type AnyProcess = Process<AnyDriver>
