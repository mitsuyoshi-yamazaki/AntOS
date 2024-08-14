import { AnyProcess, AnyProcessId } from "os_v5/process/process"
import { Command } from "../command"
import { ProcessManager, ProcessRunningState } from "os_v5/system_calls/process_manager/process_manager"
import { AlignedProcessInfo, processDescription } from "./utilities"
import { DependencyGraphNode } from "os_v5/system_calls/process_manager/process_dependency_graph"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { describeSerializableObject } from "shared/utility/serializable_types"


const helpText = `
process {arg} option={option}
- arg: process ID or part of process type name (filter)
- option: one of following output options:
  - description:  shows process description (default)
  - graph:        shows dependency graph
  - memory:       shows memory content
`

export const ProcessCommand: Command = {
  command: "process",

  help(): string {
    return helpText
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string {
    const filteringWord = argumentParser.string([0, "process ID / filtering term (process type)"]).parseOptional()
    const options = argumentParser.options()

    if (options.length <= 0) {
      return listProcessDescription(filteringWord)
    }

    const process = argumentParser.process([0, "process ID"]).parse()

    if (argumentParser.hasOption("m")) {
      return showMemory(process)
    }

    if (argumentParser.hasOption("g")) {
      if (argumentParser.hasOption("r")) {
        // 指定のProcessが依存しているProcessの表示
        throw "Not implemented yet" // TODO:
      } else {
        // 指定のProcessに依存しているProcessの表示
        return processDependencyGraph(process.processId)
      }
    }

    throw `Unknown options ${options}`
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
    AlignedProcessInfo.header("PID", "Type", "Identifier", "Running", "Description [s tatic]"),
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
const processDependencyGraph = (processId: AnyProcessId): string => {
  const graph = ProcessManager.getDependingProcessGraphRecursively(processId)
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


// ---- Memory ---- //
const showMemory = (process: AnyProcess): string => {
  const runningState = {
    process,
    ...ProcessManager.getProcessRunningState(process.processId),
  }
  const processState = process.encode()

  const results: string[] = [
    AlignedProcessInfo.header("PID", "Type", "Identifier", "Running", "Description [s tatic]"),
    processDescription(runningState),
    "Process State:",
    describeSerializableObject(processState),
  ]

  return results.join("\n")
}
