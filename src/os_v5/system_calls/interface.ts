import { KernelLifecycleMethods } from "../kernel_lifecycle"
import { SystemCall } from "../system_call"
import { Logger } from "./logger"
import { ProcessManager } from "./process_manager"

class SystemCallList {
  readonly logger = Logger
  readonly processManager = ProcessManager
}

const systemCallList = new SystemCallList()

export const SystemCalls: { [Key in keyof SystemCallList]: Omit<SystemCallList[Key], KernelLifecycleMethods> } = systemCallList

export const systemCallLifecycles: SystemCall[] = Array.from(Object.values(systemCallList))
