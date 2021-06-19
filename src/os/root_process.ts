import { rootProcessParentId, rootProcessId } from "./reserved_process_ids"
import {
  Process,
  PriorityInformation,
  ProcessRequirement,
  ProcessResult,
  ProcessState,
} from "./process"

/**
 * - RootProcessは状態をもたずに起動できる
 */
export class RootProcess implements Process {

  public readonly processId = rootProcessId
  public readonly parentProcessId = rootProcessParentId

  public get priority(): PriorityInformation {
    return {} // TODO: highestにする
  }

  public constructor() {
  }

  public run(requirement: ProcessRequirement): ProcessResult {
    return {}
  }

  // ---- Persistent Store ---- //
  public encode(): ProcessState {
    return {
      processType: "root",
      processId: this.processId,
      state: {},
      childStates: [] // TODO:
    }
  }

  public decodeChildProcesses(childStates: ProcessState[]): Process[] {
    return [] // TODO:
  }
}
