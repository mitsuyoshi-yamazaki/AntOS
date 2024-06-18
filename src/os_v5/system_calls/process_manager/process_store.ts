import { PrimitiveLogger } from "shared/utility/logger/primitive_logger"
import { AnyProcess, AnyProcessId, Process, ProcessId, ProcessSpecifier } from "../../process/process"
import { SerializableObject } from "os_v5/utility/types"
import { ProcessTypes } from "../../process/process_type_map"
import { ValuedMapMap } from "shared/utility/valued_collection"

type ProcessIdentifier = string


export class ProcessStore {
  /// IDからProcessを取得
  private readonly processMap = new Map<AnyProcessId, AnyProcess>()

  /// ProcessType, IdentifierからProcessを取得
  private readonly processIdentifierMap = new ValuedMapMap<ProcessTypes, ProcessIdentifier, AnyProcess>()

  /// Process実行順を保存
  private readonly processList: AnyProcess[] = []

  /// 依存関係を保存
  // private readonly dependencyGraph =

  private suspendedProcessIds: AnyProcessId[] = []


  // Public API
  public add<D, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(process: P): void {
    this.processList.push(process)
    this.processMap.set(process.processId, process)
    this.processIdentifierMap.getValueFor(process.processType).set(process.identifier, process)

  }

  public remove(process: AnyProcess): void {
    const processListIndex = this.processList.indexOf(process)
    if (processListIndex >= 0) {
      this.processList.splice(processListIndex, 1)
    } else {
      this.programError("remove", `Process ${process.processId} not found in the process list`)
    }

    if (this.processMap.has(process.processId) === true) {
      this.processMap.delete(process.processId)
    } else {
      this.programError("remove", `Process ${process.processId} not found in the process ID map`)
    }

    if (this.processIdentifierMap.getValueFor(process.processType).has(process.identifier) === true) {
      this.processIdentifierMap.getValueFor(process.processType).delete(process.identifier)
    } else {
      this.programError("remove", `Process ${process.processId} not found in the process identifier map`)
    }

    const suspendIndex = this.suspendedProcessIds.indexOf(process.processId)
    if (suspendIndex >= 0) {
      this.suspendedProcessIds.splice(suspendIndex, 1)
    }

    // TODO: 依存関係の解決をする
  }

  public suspend(processId: AnyProcessId): boolean {
    if (this.processMap.has(processId) !== true) {
      this.programError("suspend", `Process ${processId} not found in the process ID map`)
      return false
    }
    if (this.suspendedProcessIds.includes(processId) === true) {
      this.programError("suspend", `Process ${processId} is already suspended`)
      return false
    }
    this.suspendedProcessIds.push(processId)
    return true
  }

  public resume(processId: AnyProcessId): boolean {
    const index = this.suspendedProcessIds.indexOf(processId)
    if (index < 0) {
      this.programError("resume", `Process ${processId} is not suspended`)
      return false
    }
    this.suspendedProcessIds.splice(index, 1)
    return true
  }

  public getProcessById<D, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processId: ProcessId<D, I, M, S, P>): P | null {
    return this.processMap.get(processId) as P | null
  }

  public getProcessByIdentifier<D, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processType: ProcessTypes, identifier: I): P | null {
    const process: AnyProcess | undefined = this.processIdentifierMap.getValueFor(processType).get(identifier)
    return process as P
  }

  public isProcessSuspended(processId: AnyProcessId): boolean {
    return this.suspendedProcessIds.includes(processId)
  }

  public checkDependencies(dependentProcesses: ProcessSpecifier[]): { missingDependencies: ProcessSpecifier[] } {
    const missingDependencies: ProcessSpecifier[] = dependentProcesses.filter(dependency => {
      const processMap = this.processIdentifierMap.get(dependency.processType)
      if (processMap == null) {
        return true // 存在しない場合をフィルタするためtrueで返す
      }
      return processMap.has(dependency.identifier) !== true
    })

    return {
      missingDependencies,
    }
  }

  public listProcesses(): AnyProcess[] {
    return [...this.processList]
  }

  public setSuspendedProcessIds(ids: AnyProcessId[]): void {
    this.suspendedProcessIds = [...ids]
  }

  public getSuspendedProcessIds(): AnyProcessId[] {
    return [...this.suspendedProcessIds]
  }

  // Private API
  private programError(label: string, message: string): void {
    PrimitiveLogger.programError(`[ProcessStore.${label}] ${message}`)
  }
}
