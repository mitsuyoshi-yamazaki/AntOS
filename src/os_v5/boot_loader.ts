import { Kernel } from "./kernel"
import { KernelMemory } from "./kernel_memory"

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

  run(): void {
    Kernel.run()
  },
}
