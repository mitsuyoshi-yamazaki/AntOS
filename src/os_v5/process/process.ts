import { AnySerializable, SerializableObject } from "os_v5/utility/types"

/**
# Process
## 概要

## Codable
- メモリ空間の節約のため、Processタイプ指定子はa以上の36 radixで表現する
  - 固定値であるため実装時に重複のないように指定する
  - 現在：a
  - デコーダにマップを移す
 */

// ---- ProcessId ---- //
declare namespace Tag {
  const OpaqueTagSymbol: unique symbol

  class OpaqueTag<T> {
    private [OpaqueTagSymbol]: T
  }
}
export type ProcessId<D, I, M, S extends SerializableObject, P extends Process<D, I, M, S, P>> = string & Tag.OpaqueTag<P>


// ---- Process ---- //
export type ProcessSpecifier = {
  readonly processType: string
  readonly processSpecifier: string
}
export type ProcessDependencies = {
  readonly driverNames: string[]
  readonly processes: ProcessSpecifier[]
}

export type ReadonlySharedMemory = {
  get<T>(processType: string, processSpecifier: string): T | null
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RestrictedProcessState<S extends SerializableObject> = S extends {i: any} | {t: any} ? never : S // t, i は ProcessManager が予約済み


export interface Process<Dependency, Identifier, ProcessMemory, ProcessState extends SerializableObject, This extends Process<Dependency, Identifier, ProcessMemory, ProcessState, This>> {
  readonly processId: ProcessId<Dependency, Identifier, ProcessMemory, ProcessState, This>
  readonly identifier: Identifier
  readonly dependencies: ProcessDependencies

  encode(): RestrictedProcessState<ProcessState>

  getDependentData(sharedMemory: ReadonlySharedMemory): Dependency

  shortDescription(): string
  runtimeDescription(dependency: Dependency): string

  run(dependency: Dependency): ProcessMemory
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyProcessId = ProcessId<any, any, any, any, any>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyProcess = Process<any, any, any, any, any>
