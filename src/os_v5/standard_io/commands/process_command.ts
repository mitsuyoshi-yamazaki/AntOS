import { AnyProcess, AnyProcessId } from "os_v5/process/process"
import { Command } from "../command"
import { ProcessManager, ProcessRunningState } from "os_v5/system_calls/process_manager/process_manager"
import { alignedProcessInfo, processDescription } from "./utilities"

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
  const processDescriptions = processRunningStates.map(processDescription)

  const results: string[] = [
    alignedProcessInfo("PID", "Type", "Identifier", "Running", "Description"),
    ...processDescriptions,
  ]

  return results.join("\n")
}

const getFilteredProcessRunningStates = (filteringWord: string | null): ({ process: AnyProcess } & ProcessRunningState)[] => {
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

