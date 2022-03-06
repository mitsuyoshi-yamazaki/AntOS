import { Process, ProcessId } from "../../process/process"
import { generateUniqueId } from "utility/unique_id"

export const ProcessAccessor = {
  launch(launcher: (ProcessId) => Process): Process {
    return launcher(createProcessId)
  }
}

function createProcessId(): ProcessId {
  return generateUniqueId()
}
