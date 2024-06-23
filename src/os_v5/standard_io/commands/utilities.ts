import { AnyProcess } from "os_v5/process/process"
import { ProcessManager, ProcessRunningState } from "os_v5/system_calls/process_manager/process_manager"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"

export const processDescription = (processRunningState: { process: AnyProcess } & ProcessRunningState): string => {
  const process = processRunningState.process
  const runningState = processRunningState.isRunning === true ? "" : "suspended"
  const processDescription = ((): string => {
    const runtimeDescription = ProcessManager.getRuntimeDescription(process)
    if (runtimeDescription != null) {
      return runtimeDescription
    }
    return `[s] ${process.staticDescription()}`
  })()
  return alignedProcessInfo(process.processId, process.processType, process.identifier, runningState, processDescription)
}

const tab = ConsoleUtility.tab
const TabSize = ConsoleUtility.TabSize

export const alignedProcessInfo = (processId: string, processType: string, identifier: string, runningState: string, description: string): string => {
  return `${tab(processId, TabSize.small)} ${tab(processType, TabSize.veryLarge)} ${tab(identifier, TabSize.large)} ${tab(runningState, TabSize.medium)} ${description}`
}

export const alignedProcessActionResult = (result: string, processId: string, processType: string, identifier: string, runningState: string, description: string): string => {
  return `${tab(result, TabSize.small)} ${tab(processId, TabSize.small)} ${tab(processType, TabSize.veryLarge)} ${tab(identifier, TabSize.large)} ${tab(runningState, TabSize.medium)} ${description}`
}
