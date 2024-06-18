import { AnyProcessId } from "os_v5/process/process"
import { Command } from "../command"
import { ProcessManager } from "os_v5/system_calls/process_manager/process_manager"
import { ElementType } from "shared/utility/types"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"

type ProcessRunningState = ElementType<ReturnType<typeof ProcessManager.listProcessRunningStates>>

const helpText = `
> process {arg}
arg: process ID or part of process type name
`

export const ProcessCommand: Command = {
  command: "process",

  /** @throws */
  help(): string {
    return helpText
  },

  /** @throws */
  run(args: string[]): string {
    return listProcessDescription(args[0] ?? null)
  },
}

/**
 * @param filteringWord : ProcessId or part of process type name
 * @returns
 */
const listProcessDescription = (filteringWord: string | null): string => {
  const processRunningStates = getFilteredProcessRunningStates(filteringWord)
  const processDescriptions = processRunningStates.map((state): string => {
    const process = state.process
    const runningState = state.isRunning === true ? "" : "suspended"
    const processDescription = ((): string => {
      const runtimeDescription = ProcessManager.getRuntimeDescription(process)
      if (runtimeDescription != null) {
        return runtimeDescription
      }
      return `[s] ${process.staticDescription()}`
    })()
    return alignedText(process.processId, process.processType, process.identifier, runningState, processDescription)
  })

  const results: string[] = [
    alignedText("PID", "Type", "Identifier", "Running", "Description"),
    ...processDescriptions,
  ]

  return results.join("\n")
}

const getFilteredProcessRunningStates = (filteringWord: string | null): ProcessRunningState[] => {
  if (filteringWord == null || filteringWord.length <= 0) {
    return ProcessManager.listProcessRunningStates()
  }

  const process = ProcessManager.getProcess(filteringWord as AnyProcessId)
  if (process != null) {
    return [{
      process,
      ...ProcessManager.getProcessRunningState(process.processId),
    }]
  }

  const lowerFilteringWord = filteringWord.toLowerCase()
  return ProcessManager.listProcessRunningStates().filter(state => {
    return state.process.processType.toLowerCase().includes(lowerFilteringWord) === true
  })
}


const tab = ConsoleUtility.tab
const TabSize = ConsoleUtility.TabSize
const alignedText = (processId: string, processType: string, identifier: string, runningState: string, description: string): string => {
  return `${tab(processId, TabSize.small)}${tab(processType, TabSize.large)}${tab(identifier, TabSize.medium)}${tab(runningState, TabSize.medium)}${description}`
}
