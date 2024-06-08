import { Codable } from "../utility/codable"

/**
# Process
## 概要

## Codable
- メモリ空間の節約のため、Processタイプ指定子はa以上の36 radixで表現する
  - 固定値であるため実装時に重複のないように指定する
  - 現在：a
  - デコーダにマップを移す
 */

declare namespace Tag {
  const OpaqueTagSymbol: unique symbol

  class OpaqueTag<T> {
    private [OpaqueTagSymbol]: T
  }
}
export type ProcessId<D, P extends Process<D, P>> = string & Tag.OpaqueTag<P>


type ProcessSpecifier = {
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

export interface Process<Dependency, This extends Process<Dependency, This>> extends Codable {
  readonly processId: ProcessId<Dependency, This>
  readonly dependencies: ProcessDependencies

  getDependentData(sharedMemory: ReadonlySharedMemory): Dependency

  shortDescription(): string
  runtimeDescription(dependency: Dependency): string

  run(dependency: Dependency): void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyProcessId = ProcessId<any, any>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyProcess = Process<any, any>
