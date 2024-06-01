import { Kernel } from "./kernel"

/**
# BootLoader
## 概要
- 現在はKernelのラッパー
 */

export const BootLoader = {
  load(): void {
    Kernel.load()
  },

  run(): void {
    Kernel.run()
  },
}
