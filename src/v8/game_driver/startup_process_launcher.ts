import { IndependentGameDriver } from "../operating_system/game_driver"
import { } from "../process/owned_room_process/owned_room_parent_process"

interface StartupProcessLauncher extends IndependentGameDriver {
}

export const StartupProcessLauncher: StartupProcessLauncher = {
  load(): void {
    // TODO: launch
  },

  beforeTick(): void {
  },

  afterTick(): void {
  },
}
