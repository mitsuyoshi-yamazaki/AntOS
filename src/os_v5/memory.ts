import { AnySerializable } from "shared/utility/serializable_types"

export type KernelMemory = {
  version: string
  readonly systemCall: { [Key: string]: AnySerializable }
}

declare global {
  interface Memory {
    osv5: KernelMemory
  }
}
