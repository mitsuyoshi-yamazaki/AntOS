import {
  Process,
  ProcessId,
  PriorityInformation,
  ProcessRequirement,
  ProcessResult,
} from "./process"

export class ParentProcess implements Process {
  public get parentProcessId(): ProcessId {
    return 0
  }

  public get priority(): PriorityInformation {
    return {}
  }

  public run(requirement: ProcessRequirement): ProcessResult {
    return {}
  }
}
