import { Mutable } from "shared/utility/types"
import { SemanticVersion } from "shared/utility/semantic_version"

export type KernelMemory = {
  version: string
  readonly systemCall: { [Key: string]: unknown }
  readonly driver: { [Key: string]: unknown }
}

export const initializeKernelMemory = (memory: unknown): KernelMemory => {
  const kernelMemory = memory as Mutable<KernelMemory>

  if (kernelMemory.version == null) {
    kernelMemory.version = `${new SemanticVersion(5, 0, 0)}`
  }
  if (kernelMemory.systemCall == null) {
    kernelMemory.systemCall = {}
  }
  if (kernelMemory.driver == null) {
    kernelMemory.driver = {}
  }

  return kernelMemory
}

