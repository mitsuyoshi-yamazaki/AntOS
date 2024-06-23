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
export type ProcessId<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>> = string & Tag.OpaqueTag<P>


// ---- Process ---- //
export type ProcessSpecifier = {
  readonly processType: ProcessTypes
  readonly identifier: string
}
export type ProcessDependencies = {
  readonly processes: ProcessSpecifier[]
}

export type ReadonlySharedMemory = {
  get<T extends Record<string, unknown>>(processType: ProcessTypes, identifier: string): T | null
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RestrictedProcessState<S extends SerializableObject> = S extends {i: any} | {t: any} ? never : S // t, i は ProcessManager が予約済み


export abstract class Process<
    Dependency extends Record<string, unknown> | void,
    Identifier extends string,
    ProcessMemory,
    ProcessState extends SerializableObject,
    This extends Process<Dependency, Identifier, ProcessMemory, ProcessState, This>
  > {

  readonly abstract processId: ProcessId<Dependency, Identifier, ProcessMemory, ProcessState, This>
  readonly abstract identifier: Identifier
  readonly abstract dependencies: ProcessDependencies // 依存先指定をインスタンスメンバに入れることで、インスタンスごとに依存先を変更できる

  abstract encode(): RestrictedProcessState<ProcessState>

  abstract getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null

  abstract staticDescription(): string
  abstract runtimeDescription(dependency: Dependency): string

  didLaunch?(): void      /// 起動完了
  willTerminate?(): void  /// 停止
  abstract run(dependency: Dependency): ProcessMemory
  runAfterTick?(dependency: Dependency): void

  /** @throws */
  didReceiveMessage?(args: string[], dependency: Dependency): string


  // Implementation
  public get processType(): ProcessTypes {
    return this.constructor.name as ProcessTypes
  }

  public toString(): string {
    return `(${this.processId}) ${this.processType}[${this.identifier}]`
  }

  protected getFlatDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    let dependency: Partial<Dependency> = {}

    for (const processSpecifier of this.dependencies.processes) {
      const dependentApi = sharedMemory.get(processSpecifier.processType, processSpecifier.identifier)
      if (dependentApi == null) {
        return null
      }
      dependency = {
        ...dependency,
        ...dependentApi,
      }
    }
    return dependency as Dependency
  }

  protected getNestedDependentData<T extends ProcessTypes, D extends { [K in T]: { [I: string]: unknown } }>(sharedMemory: ReadonlySharedMemory): D | null {
    const dependency: { [K in ProcessTypes]?: { [I: string]: unknown } } = {}

    for (const processSpecifier of this.dependencies.processes) {
      const dependentApi = sharedMemory.get(processSpecifier.processType, processSpecifier.identifier)
      if (dependentApi == null) {
        return null
      }
      const processTypeMap = ((): { [I: string]: unknown } => {
        const stored = dependency[processSpecifier.processType]
        if (stored != null) {
          return stored
        }

        const newMap: { [I: string]: unknown } = {}
        dependency[processSpecifier.processType] = newMap
        return newMap
      })()

      processTypeMap[processSpecifier.identifier] = processTypeMap
    }
    return dependency as D
  }
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyProcess = Process<any, string, any, SerializableObject, AnyProcess>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyProcessId = ProcessId<any, string, any, SerializableObject, AnyProcess>
