import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredText } from "utility/log"
import { ProcessState } from "../process_state"
import { GameConstants } from "utility/constants"
import { Environment } from "utility/environment"
import { processLog } from "os/infrastructure/logger"
import { ProcessDecoder } from "process/process_decoder"

ProcessDecoder.register("BuyPixelProcess", state => {
  return BuyPixelProcess.decode(state as BuyPixelProcessState)
})

export interface BuyPixelProcessState extends ProcessState {
}

// Game.io("launch -l BuyPixelProcess")
export class BuyPixelProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): BuyPixelProcessState {
    return {
      t: "BuyPixelProcess",
      l: this.launchTime,
      i: this.processId,
    }
  }

  public static decode(state: BuyPixelProcessState): BuyPixelProcess {
    return new BuyPixelProcess(state.l, state.i)
  }

  public static create(processId: ProcessId): BuyPixelProcess {
    return new BuyPixelProcess(Game.time, processId)
  }

  public processShortDescription(): string {
    return `bucket: ${Game.cpu.bucket}`
  }

  public runOnTick(): void {
    if (Environment.world !== "persistent world") {
      PrimitiveLogger.programError(`${this.constructor.name} environment ${Environment.world} does not support pixel`)
      return
    }
    if (Game.cpu.bucket < GameConstants.game.cpu.bucketAmountForGeneratingPixel) {
      return
    }
    const result = Game.cpu.generatePixel()
    switch (result) {
    case OK:
      processLog(this, coloredText(`Pixel generated (${Game.resources["pixel"]})`, "info"))
      return
    case ERR_NOT_ENOUGH_RESOURCES:
      PrimitiveLogger.programError(`${this.constructor.name} generatePixel() resutns ERR_NOT_ENOUGH_RESOURCES (bucket: ${Game.cpu.bucket})`)
      return
    }
  }
}
