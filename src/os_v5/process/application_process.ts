import { SerializableObject } from "os_v5/utility/types"
import { SemanticVersion } from "shared/utility/semantic_version"
import { Process } from "./process"

/**
# ApplicationProcess
## 概要
- アプリケーションとして他のProcesを統合し、全体としてユーザーの入力を受け付けるProcess
- ProcessManager上の扱いは一般のProcessと同じ
 */

export abstract class ApplicationProcess<
    Dependency,
    Identifier extends string,
    ProcessMemory,
    ProcessState extends SerializableObject,
    This extends Process<Dependency, Identifier, ProcessMemory, ProcessState, This>
  > extends Process<Dependency, Identifier, ProcessMemory, ProcessState, This> {

  abstract readonly version: SemanticVersion
  abstract readonly applicationName: string

  /** @throws */
  abstract didReceiveMessage(args: string[], dependency: Dependency): string
}
