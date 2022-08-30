import { OperatingSystem } from "os/os"
import { isMessageObserver } from "os/infrastructure/message_observer"
import { parseProcessId } from "../../../shared/utility/argument_parser/command_utility"
import { ConsoleCommand, CommandExecutionResult } from "./console_command"

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
      return parseResult.reason
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

    const messageArguments = this.args.concat([])
    messageArguments.splice(0, 1)
    const message = messageArguments.join(" ")
    return targetProcess.didReceiveMessage(message)
  }
}
