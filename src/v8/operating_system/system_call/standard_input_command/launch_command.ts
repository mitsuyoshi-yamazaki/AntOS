import { ArgumentParser } from "os/infrastructure/console_command/utility/argument_parser"
import { ListArguments } from "os/infrastructure/console_command/utility/list_argument_parser"
import { coloredText } from "utility/log"
import { Process, ProcessId } from "v8/process/process"
import { isProcessType, ProcessType } from "v8/process/process_type"
import { StandardInputCommand } from "../standard_input_command"

/** @throws */
type ProcessLauncher = (parentProcessId: ProcessId, processType: ProcessType, args: ArgumentParser) => Process

export class LaunchCommand implements StandardInputCommand {
  public readonly description = [
    "# launch command",
    "- &ltparent process ID&gt &ltprocess type&gt &lt...arguments&gt"
  ].join("\n")

  public constructor(
    /** @throws */
    private readonly processLauncher: ProcessLauncher,
  ) {}

  public run(args: string[]): string {
    const listArguments = new ListArguments(args)
    const parentProcessId = listArguments.string(0, "parent process ID").parse()
    const processType = listArguments.typedString(1, "process type", "ProcessType", isProcessType).parse()

    const remainingArgs = args.splice(2)
    const argumentParser = new ArgumentParser(remainingArgs)

    try {
      const process = this.processLauncher(parentProcessId, processType, argumentParser)
      return `${process.constructor.name} ${process.processId} launched`

    } catch (error) {
      const message = `Launching ${processType} in ${parentProcessId} failed: ${error}`
      return `${coloredText("[Error]", "error")} ${message}`
    }
  }
}
