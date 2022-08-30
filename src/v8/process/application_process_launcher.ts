import { ArgumentParser } from "os/infrastructure/console_command/utility/argument_parser"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Process } from "./process"
import { ProcessType } from "./process_type"

/** @throws */
type Launcher = (args: ArgumentParser) => Process

const launchers = new Map<ProcessType, Launcher>()

export const ApplicationProcessLauncher = {
  register(processType: ProcessType, launcher: Launcher): void {
    if (launchers.has(processType) === true) {
      PrimitiveLogger.fatal(`ApplicationProcessLauncher registering ${processType} twice ${Game.time}`)
      return
    }
    launchers.set(processType, launcher)
  },

  /** @throws */
  launch(processType: ProcessType, args: ArgumentParser): Process {
    const launcher = launchers.get(processType)
    if (launcher == null) {
      throw `ApplicationProcessLauncher unregistered process ${processType}`
    }
    return launcher(args)
  },
}
