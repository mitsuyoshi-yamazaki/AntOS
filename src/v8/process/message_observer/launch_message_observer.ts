import { ArgumentParser } from "os/infrastructure/console_command/utility/argument_parser"
import { ProcessType } from "../process_type"
import { AnyProcess } from "../any_process"
import { ProcessId } from "../process"

export interface LaunchMessageObserver {
  /** @throws */
  didReceiveLaunchMessage(processType: ProcessType, args: ArgumentParser): (processId: ProcessId) => AnyProcess
}

export const isLaunchMessageObserver = (arg: unknown): arg is LaunchMessageObserver => {
  if ((arg as LaunchMessageObserver).didReceiveLaunchMessage == null) {
    return false
  }
  return true
}
