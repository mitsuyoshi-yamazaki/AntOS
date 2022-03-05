import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Driver } from "../driver/driver"

export class Kernel {
  public constructor(
    private readonly drivers: Driver[],
  ) {
  }

  public run(): void {
    if (Game.time % 100 === 0) {
      PrimitiveLogger.log("v8 kernel.run()")
    }
  }
}
