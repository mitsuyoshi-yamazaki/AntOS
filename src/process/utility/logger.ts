import {
  Process,
  ProcessId,
  PriorityInformation,
  ProcessRequirement,
  ProcessResult,
} from "../../os/process"

export class LoggerProcess implements Process {
  public get priority(): PriorityInformation {
    return {}
  }

  public constructor(public readonly parentProcessId: ProcessId) {

  }

  public run(requirement: ProcessRequirement): ProcessResult {
    return {}
  }
}
