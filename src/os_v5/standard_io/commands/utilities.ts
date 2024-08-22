import { AnyProcess } from "os_v5/process/process"
import { coloredProcessType } from "os_v5/process/process_type_map"
import { ProcessManager, ProcessRunningState } from "os_v5/system_calls/process_manager/process_manager"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"


// ---- Process ---- //
// Description
const getProcessIdentifier = (process: AnyProcess): string => {
  if (process.getLinkedIdentifier == null) {
    return process.identifier
  }
  return process.getLinkedIdentifier()
}

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
  return AlignedProcessInfo.processInfo(process, runningState, processDescription)
}

const tab = ConsoleUtility.tab
const TabSize = ConsoleUtility.TabSize

export const AlignedProcessInfo = {
  header(processId: string, processType: string, identifier: string, runningState: string, description: string): string {
    return `${tab(processId, TabSize.small)} ${tab(processType, TabSize.veryLarge)} ${tab(identifier, TabSize.medium)} ${tab(runningState, TabSize.small)} ${description}`
  },

  processInfo(process: AnyProcess, runningState: string, description: string): string {
    return [
      tab(process.processId, TabSize.small),
      tab(coloredProcessType(process.processType), TabSize.veryLarge, process.processType),
      tab(getProcessIdentifier(process), TabSize.medium, process.identifier),
      tab(runningState, TabSize.small),
      description
    ].join(" ")
  },
}

const AlignedProcessActionResult = {
  header(result: string, processId: string, processType: string, identifier: string, runningState: string, description: string): string {
    return `${tab(result, TabSize.small)} ${tab(processId, TabSize.small)} ${tab(processType, TabSize.veryLarge)} ${tab(identifier, TabSize.medium)} ${tab(runningState, TabSize.small)} ${description}`
  },

  actionResult(result: string, process: AnyProcess, runningState: string, description: string): string {
    return [
      tab(result, TabSize.small),
      tab(process.processId, TabSize.small),
      tab(coloredProcessType(process.processType), TabSize.veryLarge, process.processType),
      tab(getProcessIdentifier(process), TabSize.medium, process.identifier),
      tab(runningState, TabSize.small),
      description
    ].join(" ")
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

      return AlignedProcessActionResult.actionResult(resultDescription, process, `${state.isRunning}`, processDescription)
    })

  return [
    AlignedProcessActionResult.header("Result", "PID", "Type", "Identifier", "Running", "Description [s tatic]"),
    ...results,
  ]
    .join("\n")
}
