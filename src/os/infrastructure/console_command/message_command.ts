import { OperatingSystem } from "os/os"
import { parseProcessId } from "./command_utility"
import { ConsoleCommand, CommandExecutionResult } from "./console_command"

export interface MessageObserver {
  /**
   *
   * @param message
   * @returns 標準出力に表示する実行結果
   */
  didReceiveMessage(message: string): string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isMessageObserver(arg: any): arg is MessageObserver {
  return arg.didReceiveMessage !== undefined
}

export class MessageCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    const parseResult = parseProcessId(this.args)
    switch (parseResult.resultType) {
    case "succeeded":
      return this.sendMessage(parseResult.value)
    case "failed":
      return `${parseResult.error}`
    }
  }

  private sendMessage(processId: number): CommandExecutionResult {
    const targetProcess = OperatingSystem.os.processOf(processId)
    if (targetProcess == null) {
      return `Process with PID ${processId} not found`
    }
    if (!isMessageObserver(targetProcess)) {
      return `Process ${targetProcess.constructor.name} PID ${processId} cannot receive message`
    }
    if (this.args.length < 2) {
      return "No message argument"
    }
    return targetProcess.didReceiveMessage(this.args[1])
  }
}
