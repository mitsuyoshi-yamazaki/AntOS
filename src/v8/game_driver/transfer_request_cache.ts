import { IndependentGameDriver } from "../operating_system/game_driver"

export type TransferRequest = {
  readonly resource: ResourceConstant
  readonly amount: number | null

  /** t:transfer, w:withdraw */
  readonly action: "t" | "w"
}

interface TransferRequestCache extends IndependentGameDriver {
  addRequest(request: TransferRequest): void
}



export const TransferRequestCache: TransferRequestCache = {
  load(): void {
    // does nothing
  },

  beforeTick(): void {
  },

  afterTick(): void {
  },

  addRequest(request: TransferRequest): void {

  },
}
