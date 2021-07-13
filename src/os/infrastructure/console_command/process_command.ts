import { OperatingSystem } from "os/os"
import { ProcessInfo } from "os/os_process_info"
import { ConsoleCommand, CommandExecutionResult } from "./console_command"

const veryLargeTab = 40
const mediumTab = 20
const smallTab = 10
type Tab = number

const spaces = "                                                  " // 50 spaces

export class ProcessCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    if (this.args[0] != null) {
      return this.detailProcess(this.args[0])
    }
    return this.listProcess()
  }

  private detailProcess(processId: string): CommandExecutionResult {
    const parsedId = parseInt(processId, 10)
    if (isNaN(parsedId)) {
      return `Invalid process ID: ${processId}`
    }
    const processInfo = OperatingSystem.os.processInfoOf(parsedId)
    if (processInfo == null) {
      return `No process for process ID ${parsedId}`
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
        if (value instanceof Array) {
          if (value.length <= 0) {
            result.push(`${getIndent(indent)}- ${key}: []`)
          } else {
            result.push(`${getIndent(indent)}- ${key}: [`)
            result.push(getArrayDescription(value, indent + 1))
            result.push(`${getIndent(indent)}]`)
          }
        } else if (typeof (value) === "object") {
          result.push(`${getIndent(indent)}- ${key}: {`)
          result.push(getMemoryDescription(value, indent + 1))
          result.push(`${getIndent(indent)}}`)
        } else if (value == null) {
          result.push(`${getIndent(indent)}- ${key}: null`)
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
          if (value instanceof Array) {
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
          } else if (value == null) {
            result.push(`${getIndent(indent)}- null`)
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
    const basicDescription = `${processInfo.processId} ${processInfo.type}, running: ${processInfo.running}`
    if (processInfo.process.processDescription != null) {
      return `${basicDescription}\n${processInfo.process.processDescription()}`
    } else {
      return basicDescription
    }
  }

  private listProcess(): CommandExecutionResult {
    const tab = (str: string, tabs: Tab): string => this.tab(str, tabs)

    const startString = `${tab("PID", mediumTab)}${tab("Type", veryLargeTab)}${tab("Running", smallTab)}${tab("Description", mediumTab)}`
    return OperatingSystem.os.listAllProcesses().reduce((result, current) => {
      const shortDescription = current.process.processShortDescription == null ? "" : current.process.processShortDescription()
      return `${result}\n${tab(`${current.processId}`, mediumTab)}${tab(`${current.type}`, veryLargeTab)}${tab(`${current.running}`, smallTab)}${tab(shortDescription, mediumTab)}`
    }, startString)
  }

  // ---- Text ---- //
  private tab(text: string, tabs: Tab): string {
    const numberOfSpaces = Math.max(tabs - text.length, 0)
    const spacer = spaces.slice(0, numberOfSpaces)
    return `${text}${spacer}`
  }
}
