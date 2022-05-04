import { ArgumentParser } from "os/infrastructure/console_command/utility/argument_parser"
import { ListArguments } from "os/infrastructure/console_command/utility/list_argument_parser"
import { AnyProcess } from "v8/process/any_process"
import { ProcessId } from "v8/process/process"
import { isProcessType, ProcessType } from "v8/process/process_type"
import { StandardInputCommand } from "../standard_input_command"

/** @throws */
type ProcessLauncher = (parentProcessId: ProcessId, processType: ProcessType, args: ArgumentParser) => AnyProcess

export class LaunchCommand implements StandardInputCommand {
  public readonly command = "launch"

  public constructor(
    private readonly processLauncher: ProcessLauncher,
  ) {}

  /** @throws */
  public run(args: string[]): string {
    const listArguments = new ListArguments(args)
    const parentProcessId = listArguments.string(0, "parent process ID").parse()
    const processType = listArguments.typedString(1, "process type", "ProcessType", isProcessType).parse()

    const remainingArgs = args.splice(2)
    const argumentParser = new ArgumentParser(remainingArgs)

    const process = this.processLauncher(parentProcessId, processType, argumentParser)
    return `${process.constructor.name} ${process.processId} launched`
  }
}