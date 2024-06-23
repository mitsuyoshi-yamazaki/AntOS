import { AnyProcess, AnyProcessId } from "os_v5/process/process"
import { ProcessManager } from "os_v5/system_calls/process_manager/process_manager"
import { getKeyName, SingleOptionalArgument } from "../argument_parser/single_argument_parser"


export class ProcessArgument extends SingleOptionalArgument<void, AnyProcess> {
  /** throws */
  public parse(): AnyProcess {
    if (this.value == null || this.value.length <= 0) {
      throw this.missingArgumentErrorMessage()
    }

    const process = ProcessManager.getProcess(this.value as AnyProcessId)
    if (process == null) {
      throw `No process with ID ${this.value} (${getKeyName(this.key)})`
    }

    return process
  }
}
