import { UniqueId } from "utility/unique_id"
import { Process, ProcessId } from "../../process/process"
import { IndependentSystemCall } from "../system_call"

export interface ProcessAccessor extends IndependentSystemCall {
  launch(launcher: (processId: ProcessId) => Process): Process
}

export const ProcessAccessor: ProcessAccessor = {
  launch(launcher: (processId:ProcessId) => Process): Process {
    return launcher(createProcessId)
  }
}

function createProcessId(): ProcessId {
  return UniqueId.generate()
}
