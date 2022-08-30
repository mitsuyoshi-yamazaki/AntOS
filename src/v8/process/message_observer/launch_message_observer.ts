import { ArgumentParser } from "shared/utility/argument_parser/argument_parser"
import { ProcessType } from "../process_type"
import { Process, ProcessId } from "../process"

export interface LaunchMessageObserver {
  /** @throws */
  didReceiveLaunchMessage(processType: ProcessType, args: ArgumentParser): Process
  childProcessDidStop?(processId: ProcessId): void
}

export const isLauncherProcess = (arg: unknown): arg is LaunchMessageObserver => {
  if ((arg as LaunchMessageObserver).didReceiveLaunchMessage == null) {
    return false
  }
  return true
}
