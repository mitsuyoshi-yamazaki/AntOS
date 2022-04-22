import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ProcessScheduler } from "./process_scheduler"
import { } from "../game_driver/transfer_request_cache"
import { Logger } from "./system_call/logger"
import { ProcessAccessor } from "./system_call/process_accessor"
import { IndependentDriver } from "./driver"
import { IndependentGameDriver } from "./game_driver"

type SystemCalls = {
  logger: Logger
  // standardInput: StandardInput // TODO: Gameに直接接続するのではなくkernelを通す
  processAccessor: ProcessAccessor
}

export class Kernel {
  private processSchedular = new ProcessScheduler()

  public constructor(
    private readonly systemCalls: SystemCalls,
    private readonly drivers: IndependentDriver[],
    private readonly gameDrivers: IndependentGameDriver[],
  ) {
  }

  public run(): void {
    if (Game.time % 100 === 0) {
      PrimitiveLogger.log("v8 kernel.run()")
    }
  }
}
