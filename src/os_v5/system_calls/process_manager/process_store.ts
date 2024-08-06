import { PrimitiveLogger } from "shared/utility/logger/primitive_logger"
import { AnyProcess, AnyProcessId, Process, ProcessId, ProcessSpecifier } from "../../process/process"
import { SerializableObject } from "shared/utility/serializable_types"
import { processExecutionOrder, ProcessTypes } from "../../process/process_type_map"
import { ValuedMapMap } from "shared/utility/valued_collection"
import { DependencyGraphNode, ProcessDependencyGraph } from "./process_dependency_graph"

type ProcessIdentifier = string
const maxExecutingOrder = 9999


export class ProcessStore {
  /// IDからProcessを取得
  private readonly processMap = new Map<AnyProcessId, AnyProcess>()

  /// ProcessType, IdentifierからProcessを取得
  private readonly processIdentifierMap = new ValuedMapMap<ProcessTypes, ProcessIdentifier, AnyProcess>()

  /// Process実行順を保存
  private readonly processList: AnyProcess[] = []

  /// 依存関係を保存
  private readonly dependencyGraph = new ProcessDependencyGraph()

  private suspendedProcessIds = new Set<AnyProcessId>()
  private missingDependencyProcessIds = new Set<AnyProcessId>()


  // Public API
  public add<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(process: P, options?: {skipSort?: boolean}): void {
    this.processList.push(process)
    if (options?.skipSort !== true) {
      this.sortProcessList()
    }

    this.processMap.set(process.processId, process)
    this.processIdentifierMap.getValueFor(process.processType).set(process.identifier, process)
    this.dependencyGraph.add(process)
  }

  public sortProcessList(): void {
    this.processList.sort((lhs, rhs) => (processExecutionOrder.get(lhs.processType) ?? maxExecutingOrder) - (processExecutionOrder.get(rhs.processType) ?? maxExecutingOrder))
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

    this.suspendedProcessIds.delete(process.processId)
    this.dependencyGraph.remove(process)

    const dependingProcessIds = this.dependencyGraph.getDependingProcessIds(process.processId)
    dependingProcessIds.forEach(dependingProcessId => this.missingDependencyProcessIds.add(dependingProcessId))
  }

  public suspend(processId: AnyProcessId): boolean {
    if (this.processMap.has(processId) !== true) {
      this.programError("suspend", `Process ${processId} not found in the process ID map`)
      return false
    }
    this.suspendedProcessIds.add(processId)

    const dependingProcessIds = this.dependencyGraph.getDependingProcessIds(processId)
    dependingProcessIds.forEach(dependingProcessId => this.missingDependencyProcessIds.add(dependingProcessId))

    return true
  }

  public resume(processId: AnyProcessId): boolean {
    const removeFromSuspendedProcessIds = this.suspendedProcessIds.delete(processId)
    const removeFromMissingDependencyProcessIds = this.missingDependencyProcessIds.delete(processId) // TODO: 依存先が足りなければProcessManager.runで再度suspendするので、手動でresumeできるようにしている
    if (removeFromSuspendedProcessIds !== true && removeFromMissingDependencyProcessIds !== true) {
      return false
    }

    // TODO: 依存Processがsuspendしていたprocessesをresumeする

    return true
  }

  public setMissingDependency(processId: AnyProcessId): boolean {
    if (this.processMap.has(processId) !== true) {
      this.programError("setMissingDependency", `Process ${processId} not found in the process ID map`)
      return false
    }
    this.missingDependencyProcessIds.add(processId)

    const dependingProcessIds = this.dependencyGraph.getDependingProcessIds(processId)
    dependingProcessIds.forEach(dependingProcessId => this.missingDependencyProcessIds.add(dependingProcessId)) // TODO: 再帰的に行う必要がある // TODO: メソッド呼び出し元からは何がsuspendされたかわからない

    return true
  }

  public getProcessById<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processId: ProcessId<D, I, M, S, P>): P | null {
    return this.processMap.get(processId) as P | null
  }

  public getProcessByIdentifier<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processType: ProcessTypes, identifier: I): P | null {
    const process: AnyProcess | undefined = this.processIdentifierMap.getValueFor(processType).get(identifier)
    return process as P
  }

  public isProcessSuspended(processId: AnyProcessId): boolean {
    return this.suspendedProcessIds.has(processId) || this.missingDependencyProcessIds.has(processId)
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
    this.suspendedProcessIds = new Set(ids)
  }

  public getSuspendedProcessIds(): AnyProcessId[] {
    return [...this.suspendedProcessIds]
  }

  public getDependingProcessGraphRecursively(processId: AnyProcessId): DependencyGraphNode | null {
    return this.dependencyGraph.getDependingProcessGraphRecursively(processId)
  }

  // Private API
  private programError(label: string, message: string): void {
    PrimitiveLogger.programError(`[ProcessStore.${label}] ${message}`)
  }
}
