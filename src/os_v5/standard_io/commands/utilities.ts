import { AnyProcess } from "os_v5/process/process"
import { coloredProcessType, ProcessTypes } from "os_v5/process/process_type_map"
import { ProcessManager, ProcessRunningState } from "os_v5/system_calls/process_manager/process_manager"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"


// ---- Process ---- //
// Description
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
  return AlignedProcessInfo.processInfo(process.processId, process.processType, process.identifier, runningState, processDescription)
}

const tab = ConsoleUtility.tab
const TabSize = ConsoleUtility.TabSize

export const AlignedProcessInfo = {
  header(processId: string, processType: string, identifier: string, runningState: string, description: string): string {
    return `${tab(processId, TabSize.small)} ${tab(processType, TabSize.veryLarge)} ${tab(identifier, TabSize.medium)} ${tab(runningState, TabSize.small)} ${description}`
  },

  processInfo(processId: string, processType: ProcessTypes, identifier: string, runningState: string, description: string): string {
    return `${tab(processId, TabSize.small)} ${tab(coloredProcessType(processType), TabSize.veryLarge, processType)} ${tab(identifier, TabSize.medium)} ${tab(runningState, TabSize.small)} ${description}`
  },
}

const AlignedProcessActionResult = {
  header(result: string, processId: string, processType: string, identifier: string, runningState: string, description: string): string {
    return `${tab(result, TabSize.small)} ${tab(processId, TabSize.small)} ${tab(processType, TabSize.veryLarge)} ${tab(identifier, TabSize.medium)} ${tab(runningState, TabSize.small)} ${description}`
  },

  actionResult(result: string, processId: string, processType: ProcessTypes, identifier: string, runningState: string, description: string): string {
    return `${tab(result, TabSize.small)} ${tab(processId, TabSize.small)} ${tab(coloredProcessType(processType), TabSize.veryLarge, processType)} ${tab(identifier, TabSize.medium)} ${tab(runningState, TabSize.small)} ${description}`
  },
}


// Control
type ProcessControlResult = string
export const controlProcessResult = (processes: AnyProcess[], controller: (process: AnyProcess) => ProcessControlResult): string => {
  const results = processes
    .map((process): string => {
      const processDescription = ProcessManager.getRuntimeDescription(process) ?? process.staticDescription()
      const resultDescription = controller(process)
      const state = ProcessManager.getProcessRunningState(process.processId)

      return AlignedProcessActionResult.actionResult(resultDescription, process.processId, process.processType, process.identifier, `${state.isRunning}`, processDescription)
    })

  return [
    AlignedProcessActionResult.header("Result", "PID", "Type", "Identifier", "Running", "Description [s tatic]"),
    ...results,
  ]
    .join("\n")
}
