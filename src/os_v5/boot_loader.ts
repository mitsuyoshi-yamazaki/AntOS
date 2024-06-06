import { Kernel } from "./kernel"
import { KernelMemory } from "./kernel_memory"
import { SystemCalls } from "./system_calls/interface"

/**
# BootLoader
## 概要
- 現在はKernelのラッパー
 */

export const BootLoader = {
  load(): void {
    if (Memory.osv5 == null) {
      Memory.osv5 = {} as KernelMemory
    }

    Kernel.load(Memory.osv5)
  },

  run(extendGameObject: unknown): void {
    (extendGameObject as { io: (input: string) => string }).io = (input: string) => SystemCalls.standardIO.io(input)
    Kernel.run()
  },
}
