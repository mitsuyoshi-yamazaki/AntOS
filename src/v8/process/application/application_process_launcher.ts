import { ArgumentParser } from "shared/utility/argument_parser/argument_parser"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ProcessType } from "../process_type"
import { ApplicationProcess } from "./application_process"

/** @throws */
type Launcher = (args: ArgumentParser) => ApplicationProcess

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
  launch(processType: ProcessType, args: ArgumentParser): ApplicationProcess {
    const launcher = launchers.get(processType)
    if (launcher == null) {
      throw `ApplicationProcessLauncher unregistered process ${processType}`
    }
    return launcher(args)
  },
}
