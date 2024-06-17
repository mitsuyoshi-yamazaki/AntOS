import { KernelLifecycleMethods } from "../kernel_lifecycle"
import { SystemCall } from "../system_call"
import { Logger } from "./logger"
import { ProcessManager } from "./process_manager/process_manager"
import { EnvironmentVariable } from "./environment_variable"
import { UniqueId } from "./unique_id"
import { UniqueName } from "./game_system_calls/unique_name"
import { AnySerializable } from "os_v5/utility/types"
import { StartupLauncher } from "./process_manager/startup_launcher"

class SystemCallList {
  // Primitive
  readonly logger = Logger
  readonly environmentVariable = EnvironmentVariable
  readonly uniqueId = UniqueId

  // Depended

  // Process
  readonly processManager = ProcessManager

  // Game SystemCall
  readonly uniqueName = UniqueName

  // Application
  readonly startupLauncher = StartupLauncher
}

const systemCallList = new SystemCallList()


type SystemCallLifecycleFields = keyof SystemCall<string, AnySerializable>
export const SystemCalls: { [Key in keyof SystemCallList]: Omit<SystemCallList[Key], SystemCallLifecycleFields> } = systemCallList

export const systemCallLifecycles: SystemCall<string, AnySerializable>[] = Array.from(Object.values(systemCallList))
