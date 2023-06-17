import type { KernelMemory } from "v8/operating_system/kernel_memory"
import type { UniqueIdMemory } from "v8/operating_system/system_call/unique_id"

declare global {
  interface Memory {
    uniqueId: UniqueIdMemory

    v3: KernelMemory
  }
}

export const GlobalMemory = "GlobalMemory"
