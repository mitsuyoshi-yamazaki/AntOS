import { KernelLifecycleMethods } from "../kernel_lifecycle"
import { SystemCall } from "../system_call"
import { Logger } from "./logger"

class SystemCallList {
  readonly logger = Logger
}

const systemCallList = new SystemCallList()

export const SystemCalls: { [Key in keyof SystemCallList]: Omit<SystemCallList[Key], KernelLifecycleMethods> } = systemCallList

export const systemCallLifecycles: SystemCall[] = Array.from(Object.values(systemCallList))
