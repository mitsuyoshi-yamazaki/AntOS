import { KernelLifecycleMethods } from "../kernel_lifecycle"
import { SystemCall } from "../system_call"
import { Logger } from "./logger"
import { ProcessManager } from "./process_manager"
import { EnvironmentVariable } from "./environment_variable"
import { StartupLauncher } from "./depended_system_calls/startup_launcher"

class SystemCallList {
  // Primitive
  readonly logger = Logger
  readonly environmentVariable = EnvironmentVariable

  // Process
  readonly processManager = ProcessManager

  // Application
  readonly startupLauncher = StartupLauncher
}

const systemCallList = new SystemCallList()

export const SystemCalls: { [Key in keyof SystemCallList]: Omit<SystemCallList[Key], KernelLifecycleMethods> } = systemCallList

export const systemCallLifecycles: SystemCall[] = Array.from(Object.values(systemCallList))
