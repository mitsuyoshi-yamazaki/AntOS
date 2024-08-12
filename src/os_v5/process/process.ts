import type { DeferredTaskResult } from "os_v5/system_calls/depended_system_calls/deferred_task"
import type { SerializableObject } from "shared/utility/serializable_types"
import type { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { BotTypes, coloredProcessType, ProcessTypes } from "./process_type_map"

/**
# Process
## 概要

## Codable
- メモリ空間の節約のため、Processタイプ指定子はa以上の36 radixで表現する
  - 固定値であるため実装時に重複のないように指定する
 */

// ---- Error ---- //
type ProcessErrorNotExecutable = {
  readonly case: "not_executable"
  readonly reason: string
}
type ProcessErrorTypes = ProcessErrorNotExecutable

export class ProcessError extends Error {
  public constructor(
    public readonly error: ProcessErrorTypes,
  ) {
    super(error.reason)
  }
}


// ---- ProcessId ---- //
declare namespace Tag {
  const OpaqueTagSymbol: unique symbol

  class OpaqueTag<T> {
    private [OpaqueTagSymbol]: T
  }
}
export type ProcessId<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>> = string & Tag.OpaqueTag<P>


// ---- Process ---- //
export type ProcessDefaultIdentifier = "default" /// OSにひとつだけ起動する想定の Process Identifier
export const processDefaultIdentifier: ProcessDefaultIdentifier = "default"
export type ProcessSpecifier = {
  readonly processType: ProcessTypes
  readonly identifier: string
}
export type BotSpecifier = {
  readonly processType: BotTypes
  readonly identifier: string
}
export type ProcessDependencies = {
  readonly processes: ProcessSpecifier[]
}

export type ReadonlySharedMemory = {
  get<T extends Record<string, unknown>>(processType: ProcessTypes, identifier: string): T | null
}


type ProcessRunningStateChangeEventSuspended = {
  readonly case: "suspended"
  readonly reason: "manually" | "missing dependencies"
}
type ProcessRunningStateChangeEventResumed = {
  readonly case: "resumed"
  readonly reason: "manually" | "restored missing dependencies"
}
type ProcessRunningStateChangeEventKilled = {
  readonly case: "killed"
  readonly reason: "manually" | "failed to restore" | "by process"
}
export type ProcessRunningStateChangeEvent = ProcessRunningStateChangeEventSuspended | ProcessRunningStateChangeEventResumed | ProcessRunningStateChangeEventKilled


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RestrictedProcessState<S extends SerializableObject> = S extends {i: any} | {t: any} ? never : S // t, i は ProcessManager が予約済み


export abstract class Process<
    Dependency extends Record<string, unknown> | void,
    Identifier extends string,
    ProcessMemory,
    ProcessState extends SerializableObject,
    This extends Process<Dependency, Identifier, ProcessMemory, ProcessState, This>
  > {

  // Properties
  readonly abstract processId: ProcessId<Dependency, Identifier, ProcessMemory, ProcessState, This>
  readonly abstract identifier: Identifier
  readonly abstract dependencies: ProcessDependencies // 依存先指定をインスタンスメンバに入れることで、インスタンスごとに依存先を変更できる

  getLinkedIdentifier?(): string


  // Lifecycle
  abstract encode(): RestrictedProcessState<ProcessState>

  abstract getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null

  abstract staticDescription(): string
  abstract runtimeDescription(dependency: Dependency): string

  /** @throws */
  didLaunch?(): void      /// 起動完了：Process側で起動処理がある場合、ここで例外を出せばProcessの追加処理が完了しない
  didAdd?(state: "added" | "restored"): void         /// ProcessがProcessManagerへ追加された後に呼び出される。子Processの起動を行う
  willTerminate?(): void  /// 停止
  abstract run(dependency: Dependency): ProcessMemory
  runAfterTick?(dependency: Dependency): void


  // Event Handler
  /** @throws */
  didReceiveMessage?(argumentParser: ArgumentParser, dependency: Dependency): string

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  didFinishDeferredTask?(taskResult: DeferredTaskResult<string, any>): void


  // Implementation
  public get processType(): ProcessTypes {
    return this.constructor.name as ProcessTypes
  }

  public toString(): string {
    return `(${this.processId}) ${coloredProcessType(this.processType)}[${this.identifier}]`
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
export type AnyProcess = Process<Record<string, unknown> | void, string, any, SerializableObject, AnyProcess>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyProcessId = ProcessId<Record<string, unknown> | void, string, any, SerializableObject, AnyProcess>
