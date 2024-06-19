import { AnyProcess, AnyProcessId } from "os_v5/process/process"
import { Command } from "../command"
import { ProcessManager, ProcessRunningState } from "os_v5/system_calls/process_manager/process_manager"
import { alignedProcessInfo, processDescription } from "./utilities"
import { ArgumentParser } from "os_v5/utility/argument_parser/argument_parser"
import { DependencyGraphNode } from "os_v5/system_calls/process_manager/process_dependency_graph"


const optionValues = ["description", "graph", "memory"] as const
type Option = typeof optionValues[number]
const isOption = (value: string): value is Option => {
  return (optionValues as Readonly<string[]>).includes(value)
}

const helpText = `
> process {arg} option={option}
arg: process ID or part of process type name (filter)
option: one of following output options:
- description:  shows process description (default)
- graph:        shows dependency graph
- memory:       shows memory content
`

export const ProcessCommand: Command = {
  command: "process",

  /** @throws */
  help(): string {
    return helpText
  },

  /** @throws */
  run(args: string[]): string {
    const argumentParser = new ArgumentParser(args)

    const filteringWord = argumentParser.string(0).parseOptional()
    const option: Option = argumentParser.typedString("option", "Option", isOption).parseOptional() ?? "description"

    if (option === "description") {
      return listProcessDescription(filteringWord)
    }

    const processId = argumentParser.string(0, {missingArgumentErrorMessage: "No process ID at 0th argument"}).parse()

    switch (option) {
    case "graph":
      return processDependencyGraph(processId)
    case "memory":
      throw "Not implemented yet"
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = option
      throw `Invalid option ${option}`
    }
    }
  },
}

// ---- Description ---- //
/**
 * @param filteringWord : ProcessId or part of process type name
 * @returns
 */
const listProcessDescription = (filteringWord: string | null): string => {
  const processRunningStates = getFilteredProcessRunningStates(filteringWord)
  const processDescriptions = processRunningStates.map(processDescription)

  const results: string[] = [
    alignedProcessInfo("PID", "Type", "Identifier", "Running", "Description [s tatic]"),
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


// ---- Graph ---- //
/** @throws */
const processDependencyGraph = (processId: string | null): string => {
  const graph = ProcessManager.getDependingProcessGraphRecursively(processId as AnyProcessId)
  if (graph == null) {
    throw `No Process with ID ${processId}`
  }
  return describeGraphNodeRecursively(graph, "").join("\n")
}

const describeGraphNodeRecursively = (graphNode: DependencyGraphNode, indent: string): string[] => {
  const nextIndent = indent + "  "
  return [
    `${indent}- ${graphNode.processTypeIdentifier} (${graphNode.processId}):`,
    ...[...graphNode.dependingNodes].flatMap(node => describeGraphNodeRecursively(node, nextIndent)),
  ]
}
