import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { OperatingSystem } from "os/os"
import { Result } from "utility/result"
import { Process, ProcessId } from "./process"
import { KeywordArguments } from "shared/utility/argument_parser/keyword_argument_parser"

type ProcessType = string
type ProcessMaker = (processId: ProcessId) => Process
type Launcher = (args: KeywordArguments) => Result<ProcessMaker, string>

const launchers = new Map<ProcessType, Launcher>()

export const ProcessLauncher = {
  register(processType: ProcessType, launcher: Launcher): void {
    if (launchers.has(processType) === true) {
      PrimitiveLogger.fatal(`ProcessLauncher registering ${processType} twice ${Game.time}`)
    }
    launchers.set(processType, launcher)
  },

  launch(processType: ProcessType, args: KeywordArguments): Result<Process, string> {
    const launcher = launchers.get(processType)
    if (launcher == null) {
      const errorMessage = `ProcessLauncher unregistered process ${processType}`
      PrimitiveLogger.programError(errorMessage)
      return Result.Failed(errorMessage)
    }
    const result = launcher(args)
    switch (result.resultType) {
    case "failed":
      return Result.Failed(result.reason)
    case "succeeded":
      break
    }
    const process = OperatingSystem.os.addProcess(null, result.value)
    return Result.Succeeded(process)
  },
}
