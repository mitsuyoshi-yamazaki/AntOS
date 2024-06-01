import { kernel } from "./kernel"

/**
# BootLoader
## 概要
- 現在はKernelのラッパー
 */

export const bootLoader = {
  load(): void {
    kernel.load()
  },

  run(): void {
    kernel.run()
  },
}
