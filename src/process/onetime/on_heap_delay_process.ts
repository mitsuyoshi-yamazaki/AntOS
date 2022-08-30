import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { OperatingSystem } from "os/os"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessDecoder } from "process/process_decoder"
import { Assert } from "utility/assert"
import { coloredText } from "utility/log"
import { Timestamp } from "shared/utility/timestamp"
import { ProcessState } from "../process_state"

ProcessDecoder.registerUndecodableProcess("OnHeapDelayProcess")

export interface OnHeapDelayProcessState extends ProcessState {
}

export class OnHeapDelayProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly description: string,
    private readonly runOn: Timestamp,

    /** @throws */
    private readonly command: () => string,
  ) {
    this.taskIdentifier = `${this.constructor.name}_${this.processId}`
  }

  public encode(): OnHeapDelayProcessState {
    return {
      t: "OnHeapDelayProcess",
      l: this.launchTime,
      i: this.processId,
    }
  }

  public static create(processId: ProcessId, description: string, delay: Timestamp, command: () => string): OnHeapDelayProcess {
    return new OnHeapDelayProcess(Game.time, processId, description, Game.time + delay, command)
  }

  public processShortDescription(): string {
    return `${this.description}, run ${this.runOn - Game.time} ticks later`
  }

  public runOnTick(): void {
    if (Game.time < this.runOn) {
      return
    }
    if (Game.time === this.runOn) {
      try {
        PrimitiveLogger.log(this.command())
      } catch (error) {
        PrimitiveLogger.log(`${coloredText("[Error]", "error")} ${error}`)
      }
      OperatingSystem.os.killProcess(this.processId)
      return
    }

    Assert.assert(`${this.taskIdentifier} hasn't run: expected to run ${Game.time - this.runOn} ticks ago (${this.description})`)
    OperatingSystem.os.killProcess(this.processId)
  }
}
