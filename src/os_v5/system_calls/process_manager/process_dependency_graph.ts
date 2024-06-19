import { AnyProcess, AnyProcessId } from "os_v5/process/process"
import { ProcessTypes } from "os_v5/process/process_type_map"

/**
# ProcessDependencyGraph
## 要件
- Processの依存関係を、
  - 依存している側から辿ることができる：依存している側が kill した際に ProcessDependencyGraph から削除する
  - 依存されている側から辿ることができる：依存されている側の kill, suspend, resume -r 時のカスケード処理

## 課題
- Processの依存先は ProcessTypes と Identifier で指定されるが、

## Discussion
- 依存先のないProcessを記録しておき、依存先が生成されたら依存の解決を試みる
  - カスケードする
 */

type ProcessIdentifier = string
type ProcessTypeIdentifier = string
type DependingInfo = {
  processId: AnyProcessId | null
  readonly dependingProcessIds: Set<AnyProcessId>
}
export type DependencyGraphNode = {
  readonly processId: AnyProcessId
  readonly processTypeIdentifier: ProcessTypeIdentifier
  readonly dependingNodes: DependencyGraphNode[]
}

export class ProcessDependencyGraph {
  private readonly dependingProcessIds = new Map<ProcessTypeIdentifier, DependingInfo>()
  private readonly processIdentifierMap = new Map<AnyProcessId, ProcessTypeIdentifier>()

  public add(process: AnyProcess): void {
    const typeIdentifier = this.processTypeIdentifierFor(process)
    const dependingInfo = this.getDependingInfo(typeIdentifier)
    dependingInfo.processId = process.processId
    this.processIdentifierMap.set(process.processId, typeIdentifier)

    process.dependencies.processes.forEach(dependency => {
      this.getDependingInfo(this.processTypeIdentifier(dependency.processType, dependency.identifier)).dependingProcessIds.add(process.processId)
    })
  }

  public remove(process: AnyProcess): void {
    process.dependencies.processes.forEach(dependency => {
      this.getDependingInfo(this.processTypeIdentifier(dependency.processType, dependency.identifier)).dependingProcessIds.delete(process.processId)
    })

    const typeIdentifier = this.processTypeIdentifierFor(process)
    this.getDependingInfo(typeIdentifier).processId = null
    this.processIdentifierMap.delete(process.processId)
  }

  public getDependingProcessIdsRecursively(processId: AnyProcessId): AnyProcessId[] {
    const typeIdentifier = this.processIdentifierMap.get(processId)
    if (typeIdentifier == null) {
      return []
    }
    return [...this.getDependingInfo(typeIdentifier).dependingProcessIds].flatMap(
      (dependingProcessId): AnyProcessId[] => this.getDependingProcessIdsRecursively(dependingProcessId)
    )
  }

  public getDependingProcessGraphRecursively(processId: AnyProcessId): DependencyGraphNode | null {
    const typeIdentifier = this.processIdentifierMap.get(processId)
    if (typeIdentifier == null) {
      return null
    }
    const dependingNodes = [...this.getDependingInfo(typeIdentifier).dependingProcessIds]
      .flatMap((dependingProcessId): DependencyGraphNode[] => {
        const dependingNode = this.getDependingProcessGraphRecursively(dependingProcessId)
        if (dependingNode == null) {
          return []
        }
        return [dependingNode]
      })

    return {
      processId,
      processTypeIdentifier: typeIdentifier,
      dependingNodes,
    }
  }

  // Private
  private getDependingInfo(typeIdentifier: ProcessTypeIdentifier): DependingInfo {
    const info = this.dependingProcessIds.get(typeIdentifier)
    if (info != null) {
      return info
    }

    const newInfo: DependingInfo = {
      processId: null,
      dependingProcessIds: new Set<AnyProcessId>(),
    }
    this.dependingProcessIds.set(typeIdentifier, newInfo)
    return newInfo
  }

  private processTypeIdentifierFor(process: AnyProcess): ProcessTypeIdentifier {
    return this.processTypeIdentifier(process.processType, process.identifier)
  }

  private processTypeIdentifier(processType: ProcessTypes, identifier: ProcessIdentifier): ProcessTypeIdentifier {
    return `${processType}[${identifier}]`
  }
}

// export class ProcessDependencyGraph {
//   private readonly dependencyGraph = new Map<AnyProcessId, Set<AnyProcessId>>()

//   public add(process: AnyProcess): void {
//     process.dependencies.processes.forEach(dependency => {
//       this.getProcessIdSetFor(dependency.processType, dependency.identifier).add(process.processId)
//     })
//   }

//   public remove(process: AnyProcess): void {
//     process.dependencies.processes.forEach(dependency => {
//       this.getProcessIdSetFor(dependency.processType, dependency.identifier).delete(process.processId)
//     })
//   }

//   public getDependingProcessIds(process: AnyProcess): AnyProcessId[] {
//     return [...this.getProcessIdSet(process.processType, process.identifier)]
//   }

//   public getDependingGraph(process: AnyProcess): "TODO" {
//     // process本体が保管されていないと次のdepending processを辿れない
//     return "TODO"
//   }

//   private getProcessIdSetFor(processId: AnyProcessId): Set<AnyProcessId> {
//     const set = this.dependencyGraph.get(processId)
//     if (set != null) {
//       return set
//     }

//     const newSet = new Set<AnyProcessId>()
//     this.dependencyGraph.set(processId, newSet)
//     return newSet
//   }
// }

// export class ProcessDependencyGraph {
//   private readonly dependencyGraph = new ValuedMapMap<ProcessTypes, ProcessIdentifier, DependingInfo>()

//   public add(process: AnyProcess): { processIdsToResume: AnyProcessId } {
//     this.getDependingInfo(process.processType, process.identifier).processId = process.processId

//     process.dependencies.processes.forEach(dependency => {
//       this.getDependingInfo(dependency.processType, dependency.identifier).dependingProcessIds.add(process.processId)
//     })
//   }

//   public remove(process: AnyProcess): void {
//     process.dependencies.processes.forEach(dependency => {
//       this.getDependingInfo(dependency.processType, dependency.identifier).dependingProcessIds.delete(process.processId)
//     })

//     this.getDependingInfo(process.processType, process.identifier).processId = null
//   }

//   public getDependingProcessIds(process: AnyProcess): AnyProcessId[] {
//     return [...this.getDependingInfo(process.processType, process.identifier).dependingProcessIds]
//   }

//   public getDependingGraph(process: AnyProcess): "TODO" {
//     // process本体が保管されていないと次のdepending processを辿れない
//     return "TODO"
//   }

//   private getDependingInfo(processType: ProcessTypes, identifier: ProcessIdentifier): DependingInfo {
//     const info = this.dependencyGraph.getValueFor(processType).get(identifier)
//     if (info != null) {
//       return info
//     }

//     const newInfo: DependingInfo = {
//       processId: null,
//       dependingProcessIds: new Set<AnyProcessId>(),
//     }
//     this.dependencyGraph.getValueFor(processType).set(identifier, newInfo)
//     return newInfo
//   }
// }
