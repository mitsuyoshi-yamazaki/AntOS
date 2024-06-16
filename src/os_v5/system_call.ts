import { KernelLifecycle } from "./kernel_lifecycle"
import { AnySerializable } from "./utility/types"

/**
# SystemCall
 */

export interface SystemCall<Name extends string, SystemCallMemory extends AnySerializable> extends KernelLifecycle<SystemCallMemory> {
  readonly name: Name
  readonly [Symbol.toStringTag]: Name
}
