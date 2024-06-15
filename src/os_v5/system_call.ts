import { KernelLifecycle } from "./kernel_lifecycle"
import { AnySerializable } from "./utility/types"

/**
# SystemCall
 */

export interface SystemCall<SystemCallMemory extends AnySerializable> extends KernelLifecycle<SystemCallMemory> {
  readonly name: string
}
