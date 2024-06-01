import { KernelLifecycle } from "./kernel_lifecycle"

/**
# SystemCall
 */

export interface SystemCall extends KernelLifecycle {
  readonly name: string
}
