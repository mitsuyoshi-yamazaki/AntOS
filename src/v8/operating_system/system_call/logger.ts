import { SystemCall } from "../system_call"

export type Logger = SystemCall<void, void>
export const Logger: Logger = {
  beforeTick(): void {
  },

  afterTick(): void {
  },
}
