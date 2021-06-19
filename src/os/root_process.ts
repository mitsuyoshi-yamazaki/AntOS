import { rootProcessParentId, rootProcessId } from "./reserved_process_ids"
import {
  Process,
  PriorityInformation,
  ProcessRequirement,
  ProcessResult,
  ProcessState,
} from "./process"

export class RootProcess implements Process {
  private t: number

  public readonly processId = rootProcessId
  public readonly parentProcessId = rootProcessParentId

  public get priority(): PriorityInformation {
    return {} // TODO: highestにする
  }

  public constructor(t: number) {
    this.t = t
  }

  public run(requirement: ProcessRequirement): ProcessResult {
    if (this.t % 4 === 0) {
      console.log(`Root Process ${this.t}`)
    }
    this.t += 1
    return {}
  }

  // ---- Persistent Store ---- //
  public encode(): ProcessState {
    return {
      processType: "root",
      processId: this.processId,
      state: {
        t: this.t
      },
      childStates: [] // TODO:
    }
  }

  public decodeChildProcesses(childStates: ProcessState[]): Process[] {
    return [] // TODO:
  }
}
