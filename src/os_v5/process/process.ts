import { Codable } from "../utility/codable"

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
type ProcessDependencies = {
  readonly driverNames: string[]
  readonly processes: ProcessSpecifier[]
}

type ReadonlySharedMemory = {
  get<T>(processType: string, processSpecifier: string): T | null
}

export interface Process<Dependency, This extends Process<Dependency, This>> extends Codable {
  readonly processId: ProcessId<Dependency, This>
  readonly dependencies: ProcessDependencies

  getDependentData(sharedMemory: ReadonlySharedMemory): Dependency

  run(dependency: Dependency): void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyProcessId = ProcessId<any, any>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyProcess = Process<any, any>
