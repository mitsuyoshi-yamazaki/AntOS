import { IndependentDriver } from "./driver"
import { IndependentGameDriver } from "./game_driver"
import { Kernel } from "./kernel"
import { Logger } from "./system_call/logger"
import { ProcessAccessor } from "./system_call/process_accessor"

export const BootLoader = {
  loadKernel(): Kernel {
    const drivers: IndependentDriver[] = []
    const gameDrivers: IndependentGameDriver[] = []
    return new Kernel(
      {
        logger: Logger,
        processAccessor: ProcessAccessor,
      },
      drivers,
      gameDrivers,
    )
  },
}
