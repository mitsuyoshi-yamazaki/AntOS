import {
  Process,
  PriorityInformation,
  ProcessRequirement,
  ProcessResult,
} from "./process"

// 物理実体のあるプロセス
export class Agent implements Process {
  public get priority(): PriorityInformation {
    return {}
  }

  public run(requirement: ProcessRequirement): ProcessResult {
    return {}
  }
}
