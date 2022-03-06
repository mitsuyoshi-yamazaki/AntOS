import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ProcessScheduler } from "./process_scheduler"

export class Kernel {
  private processSchedular = new ProcessScheduler()

  public constructor() {
  }

  public run(): void {
    if (Game.time % 100 === 0) {
      PrimitiveLogger.log("v8 kernel.run()")
    }
  }
}
