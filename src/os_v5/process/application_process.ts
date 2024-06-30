import type { SerializableObject } from "os_v5/utility/types"
import type { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import type { SemanticVersion } from "shared/utility/semantic_version"
import { Process } from "./process"

/**
# ApplicationProcess
## 概要
- アプリケーションとして他のProcesを統合し、全体としてユーザーの入力を受け付けるProcess
- ProcessManager上の扱いは一般のProcessと同じ
 */

export abstract class ApplicationProcess<
  Dependency extends Record<string, unknown> | void,
  Identifier extends string,
  ProcessMemory,
  ProcessState extends SerializableObject,
  This extends Process<Dependency, Identifier, ProcessMemory, ProcessState, This>
  > extends Process<Dependency, Identifier, ProcessMemory, ProcessState, This> {

  abstract readonly applicationName: string
  abstract readonly version: SemanticVersion


  /** @throws */
  abstract didReceiveMessage(argumentParser: ArgumentParser, dependency: Dependency): string
}
