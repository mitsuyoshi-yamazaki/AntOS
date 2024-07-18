import { AnyProcess, AnyProcessId } from "os_v5/process/process"
import { Command } from "../command"
import { ProcessManager, ProcessRunningState } from "os_v5/system_calls/process_manager/process_manager"
import { AlignedProcessInfo, processDescription } from "./utilities"
import { DependencyGraphNode } from "os_v5/system_calls/process_manager/process_dependency_graph"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { AnySerializable, SerializableArray, SerializableObject } from "os_v5/utility/types"


const optionValues = ["description", "graph", "memory"] as const
type Option = typeof optionValues[number]
const isOption = (value: string): value is Option => {
  return (optionValues as Readonly<string[]>).includes(value)
}

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
    const option: Option = argumentParser.typedString("option", "Option", isOption).parseOptional() ?? "description"

    if (option === "description") {
      return listProcessDescription(filteringWord)
    }

    const process = argumentParser.process([0, "process ID"]).parse()

    switch (option) {
    case "graph":
      return processDependencyGraph(process.processId)
    case "memory":
      return showMemory(process)
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


// ---- Memory ---- //
const showMemory = (process: AnyProcess): string => {
  const runningState = {
    process,
    ...ProcessManager.getProcessRunningState(process.processId),
  }
  const results: string[] = [
    AlignedProcessInfo.header("PID", "Type", "Identifier", "Running", "Description [s tatic]"),
    processDescription(runningState),
  ]

  const processState = process.encode()
  results.push(getObjectDescription(processState, 0))

  return results.join("\n")
}


const spaces = "                                                  " // 50 spaces
const getIndent = (indent: number): string => spaces.slice(0, indent * 2)

const sortIndex = (value: AnySerializable): number => {
  if (value instanceof Array) {
    return 2
  } else if (typeof (value) === "object") {
    return 1
  } else {
    return 0
  }
}

const sortedKeys = (obj: SerializableObject): string[] => {
  return Object.keys(obj).sort((lhs, rhs) => sortIndex(obj[lhs]) - sortIndex(obj[rhs]))
}

const getObjectDescription = (obj: SerializableObject, indent: number): string => {
  const result: string[] = []
  sortedKeys(obj).forEach(key => {
    const value = obj[key]
    if (value == null) {
      result.push(`${getIndent(indent)}- ${key}: null`)
    } else if (value instanceof Array) {
      if (value.length <= 0) {
        result.push(`${getIndent(indent)}- ${key}: []`)
      } else {
        result.push(`${getIndent(indent)}- ${key}: [`)
        result.push(getArrayDescription(value, indent + 1))
        result.push(`${getIndent(indent)}]`)
      }
    } else if (typeof (value) === "object") { // typeof (null) == "object"
      result.push(`${getIndent(indent)}- ${key}: {`)
      result.push(getObjectDescription(value, indent + 1))
      result.push(`${getIndent(indent)}}`)
    } else {
      result.push(`${getIndent(indent)}- ${key}: ${value}`)
    }
  })
  return result.join("\n")
}

const getArrayDescription = (array: SerializableArray, indent: number): string => {
  const result: string[] = []
  array.concat([])
    .sort((lhs, rhs) => sortIndex(lhs) - sortIndex(rhs))
    .forEach(value => {
      if (value == null) {
        result.push(`${getIndent(indent)}- null`)
      } else if (value instanceof Array) {
        if (value.length <= 0) {
          result.push(`${getIndent(indent)}- []`)
        } else {
          result.push(`${getIndent(indent)}- [`)
          result.push(getArrayDescription(value, indent + 1))
          result.push(`${getIndent(indent)}]`)
        }
      } else if (typeof (value) === "object") {
        result.push(`${getIndent(indent)}- {`)
        result.push(getObjectDescription(value, indent + 1))
        result.push(`${getIndent(indent)}}`)
      } else {
        result.push(`${getIndent(indent)}- ${value}`)
      }
    })
  return result.join("\n")
}
