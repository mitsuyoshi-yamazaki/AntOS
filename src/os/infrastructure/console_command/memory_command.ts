import { ErrorMapper } from "error_mapper/ErrorMapper"
import { Result } from "shared/utility/result"
import { ConsoleCommand, CommandExecutionResult } from "./console_command"

export class MemoryCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    const result = ErrorMapper.wrapLoop((): CommandExecutionResult => {
      return this.execute()
    }, "MemoryCommand.execute()")()

    if (result != null) {
      return result
    }
    return "memory command execution failed"
  }

  private execute(): CommandExecutionResult {
    const result = ((): Result<string, string> => {
      switch (this.args[0]) {
      case "SetResearchCompound":
        return this.setResearchCompound()
      default:
        return Result.Failed(`Unsupported command ${this.args[0]}`)
      }
    })()

    switch (result.resultType) {
    case "succeeded":
      return result.value
    case "failed":
      return result.reason
    }
  }

  private parseProcessArguments(...keys: string[]): string[] | string {
    const args = this.args.concat([])
    args.splice(0, 1)
    const argumentMap = new Map<string, string>()
    args.forEach(arg => {
      const [key, value] = arg.split("=")
      if (key == null || value == null) {
        return
      }
      argumentMap.set(key, value)
    })

    const result: string[] = []
    const missingKeys: string[] = []

    keys.forEach(key => {
      const value = argumentMap.get(key)
      if (value == null) {
        missingKeys.push(key)
        return
      }
      result.push(value)
    })
    if (missingKeys.length > 0) {
      return `Missing arguments: ${missingKeys}`
    }
    return result
  }

  // ---- ---- //
  private setResearchCompound(): Result<string, string> {
    // const args = this.parseProcessArguments("room_name", "compound")
    // if (typeof args === "string" || args.some(a => a == null)) {
    //   return Result.Failed(`${args}`)
    // }
    // const [roomName, compound] = args

    return Result.Failed("not implemented yet")
  }
}
