import { ErrorMapper } from "error_mapper/ErrorMapper"
import { OperatingSystem } from "os/os"
import { ProcessInfo } from "os/os_process_info"
import { ProcessId } from "process/process"
import { Tab, tab } from "utility/log"
import { ConsoleCommand, CommandExecutionResult } from "./console_command"

const veryLargeTab = Tab.veryLarge
const mediumTab = Tab.medium
const smallTab = Tab.small
const spaces = "                                                  " // 50 spaces

export class ProcessCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    switch (this.args[0]) {
    case "type":
      return this.showProcessType()
    case null:
    case undefined:
      return this.listProcess()
    default: {
      const processId = parseInt(this.args[0], 10)
      if (isNaN(processId) === true) {
        return this.listProcess(this.args[0])
      } else {
        return this.showProcessDetail(processId)
      }
    }
    }
  }

  private showProcessType(): CommandExecutionResult {
    const processTypeDescriptions = new Map < string, { count: number, running: number }>() // <process type name, {}>
    const getTypeDescription = (processName: string): { count: number, running: number } => {
      const stored = processTypeDescriptions.get(processName)
      if (stored != null) {
        return stored
      }
      const newObj = {
        count: 0,
        running: 0
      }
      processTypeDescriptions.set(processName, newObj)
      return newObj
    }

    OperatingSystem.os.listAllProcesses().forEach(processInfo => {
      const typeDescription = getTypeDescription(processInfo.process.constructor.name)
      typeDescription.count += 1
      if (processInfo.running === true) {
        typeDescription.running += 1
      }
    })

    const getAlignedText = (processType: string, running: string): string => {
      return `${tab(running, smallTab)}${tab(processType, veryLargeTab)}`
    }

    const header = getAlignedText("Process Type", "Running/Count")
    const results: string[] = [
      header,
      ...Array.from(processTypeDescriptions.entries()).map(([processTypeName, description]): string => {
        return getAlignedText(processTypeName, `${description.running}/${description.count}`)
      }),
    ]

    return results.join("\n")
  }

  private showProcessDetail(processId: ProcessId): CommandExecutionResult {
    const processInfo = OperatingSystem.os.processInfoOf(processId)
    if (processInfo == null) {
      return `No process for process ID ${processId}`
    }

    if (this.options.get("-m") != null) {
      return this.showMemory(processInfo)
    } else {
      return this.describeProcess(processInfo)
    }
  }

  private showMemory(processInfo: ProcessInfo): CommandExecutionResult {
    const header = `${this.tab("PID", mediumTab)}${this.tab("Type", veryLargeTab)}${this.tab("Running", smallTab)}${this.tab("Description", mediumTab)}`
    const shortDescription = processInfo.process.processShortDescription == null ? "" : processInfo.process.processShortDescription()
    const processDescription = `${this.tab(`${processInfo.processId}`, mediumTab)}${this.tab(`${processInfo.type}`, veryLargeTab)}${this.tab(`${processInfo.running}`, smallTab)}${this.tab(shortDescription, mediumTab)}`

    const getIndent = (indent: number): string => spaces.slice(0, indent * 2)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sortIndex = (value: any): number => {
      if (value instanceof Array) {
        return 2
      } else if (typeof (value) === "object") {
        return 1
      } else {
        return 0
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sortedKeys = (memory: any): string[] => {
      return Object.keys(memory).sort((lhs, rhs) => sortIndex(memory[lhs]) - sortIndex(memory[rhs]))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getMemoryDescription = (memory: any, indent: number): string => { // TODO: childrenが最後になるようソートする
      const result: string[] = []
      sortedKeys(memory).forEach(key => {
        const value = memory[key]
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
          result.push(getMemoryDescription(value, indent + 1))
          result.push(`${getIndent(indent)}}`)
        } else {
          result.push(`${getIndent(indent)}- ${key}: ${value}`)
        }
      })
      return result.join("\n")
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getArrayDescription = (array: Array<any>, indent: number): string => {
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
            result.push(getMemoryDescription(value, indent + 1))
            result.push(`${getIndent(indent)}}`)
          } else {
            result.push(`${getIndent(indent)}- ${value}`)
          }
        })
      return result.join("\n")
    }

    const memoryDescription = getMemoryDescription(processInfo.process.encode(), 0)
    return `${header}\n${processDescription}\n${memoryDescription}`
  }

  private describeProcess(processInfo: ProcessInfo): CommandExecutionResult {
    const result = ErrorMapper.wrapLoop((): string => {
      const basicDescription = `${processInfo.processId} ${processInfo.type}, running: ${processInfo.running}`
      if (processInfo.process.processDescription != null) {
        return `${basicDescription}\n${processInfo.process.processDescription()}`
      } else if (processInfo.process.processShortDescription != null) {
        return `${basicDescription}\n${processInfo.process.processShortDescription()}`
      } else {
        return basicDescription
      }
    }, "")()

    return result ?? primitiveErrorDescriptionFor(processInfo)
  }

  private listProcess(filterTypeName?: string): CommandExecutionResult {
    const commandRunner = new ProcessCommandRunner()
    if (filterTypeName == null) {
      return commandRunner.listProcess()
    }
    return commandRunner.listProcess(filterTypeName)
  }

  // ---- Text ---- //
  private tab(text: string, tabs: Tab): string {
    return tab(text, tabs)
  }
}

export class ProcessCommandRunner {
  public listProcess(): string
  public listProcess(filterTypeName: string): string
  public listProcess(processIds: ProcessId[]): string
  public listProcess(arg?: string | ProcessId[]): string {
    const filter = ((): (info: { processInfo: ProcessInfo, index: number }) => boolean => {
      if (arg == null) {
        return () => true
      }
      if (typeof arg === "string") {
        const lowercasedFilterTypeName = arg.toLowerCase()
        return info => (info.processInfo.type.toLowerCase().includes(lowercasedFilterTypeName) === true)
      }
      return info => arg.includes(info.processInfo.processId)
    })()

    const getAlignedText = (index: string, processId: string, typeIdentifier: string, runningState: string, description: string): string => {
      return `${tab(index, smallTab)}${tab(processId, mediumTab)}${tab(typeIdentifier, veryLargeTab)}${tab(runningState, smallTab)}${tab(description, mediumTab)}`
    }

    const results: string[] = [
      getAlignedText("Index", "PID", "Type", "Running", "Description"),
    ]
    const processDescriptions = OperatingSystem.os.listAllProcesses().map((processInfo, index) => ({ processInfo, index })).filter(filter).map(info => {
      const result = ErrorMapper.wrapLoop((): string => {
        const { processInfo, index } = info
        const shortDescription = processInfo.process.processShortDescription == null ? "" : processInfo.process.processShortDescription()
        return getAlignedText(`${index}`, `${processInfo.processId}`, processInfo.type, `${processInfo.running}`, shortDescription)
      }, "")()
      return result ?? primitiveErrorDescriptionFor(info.processInfo)
    })
    results.push(...processDescriptions)

    return results.join("\n")
  }
}

function primitiveErrorDescriptionFor(processInfo: ProcessInfo): string {
  return `${processInfo.process.constructor.name} ${processInfo.processId}`
}
