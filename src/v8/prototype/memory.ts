import type { KernelMemory } from "v8/operating_system/kernel_memory"

declare global {
  interface Memory {
    v3: KernelMemory
  }
}

export const GlobalMemory = "GlobalMemory"
