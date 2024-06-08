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

  run(extendGameObject: unknown): void {
    (extendGameObject as { io: (input: string) => string }).io = (input: string) => Kernel.io(input)
    Kernel.startOfTick()
    Kernel.run()
    Kernel.endOfTick()
  },
}
