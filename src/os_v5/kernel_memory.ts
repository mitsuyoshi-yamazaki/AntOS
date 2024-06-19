import { Mutable } from "shared/utility/types"
import { SemanticVersion } from "shared/utility/semantic_version"
import { KernelMemory } from "./memory"

export const initializeKernelMemory = (memory: KernelMemory): KernelMemory => {
  const kernelMemory = memory as Mutable<KernelMemory>

  if (kernelMemory.version == null) {
    kernelMemory.version = `${new SemanticVersion(5, 0, 0)}`
  }
  if (kernelMemory.systemCall == null) {
    kernelMemory.systemCall = {}
  }

  return kernelMemory
}

