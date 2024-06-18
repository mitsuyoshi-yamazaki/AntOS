import { SerializableObject } from "os_v5/utility/types"
import { ProcessTypes } from "./process_type_map"

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
export type ProcessId<D, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>> = string & Tag.OpaqueTag<P>


// ---- Process ---- //
export type ProcessSpecifier = {
  readonly processType: ProcessTypes
  readonly identifier: string
}
export type ProcessDependencies = {
  readonly processes: ProcessSpecifier[]
}

export type ReadonlySharedMemory = {
  get<T>(processType: ProcessTypes, identifier: string): T | null
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RestrictedProcessState<S extends SerializableObject> = S extends {i: any} | {t: any} ? never : S // t, i は ProcessManager が予約済み


export abstract class Process<Dependency, Identifier extends string, ProcessMemory, ProcessState extends SerializableObject, This extends Process<Dependency, Identifier, ProcessMemory, ProcessState, This>> {
  readonly abstract processId: ProcessId<Dependency, Identifier, ProcessMemory, ProcessState, This>
  readonly abstract identifier: Identifier
  readonly abstract dependencies: ProcessDependencies

  abstract encode(): RestrictedProcessState<ProcessState>

  abstract getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null

  abstract staticDescription(): string
  abstract runtimeDescription(dependency: Dependency): string

  abstract run(dependency: Dependency): ProcessMemory
  runAfterTick?(dependency: Dependency): void

  //
  public get processType(): ProcessTypes {
    return this.constructor.name as ProcessTypes
  }
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyProcess = Process<any, string, any, SerializableObject, AnyProcess>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyProcessId = ProcessId<any, string, any, SerializableObject, AnyProcess>
