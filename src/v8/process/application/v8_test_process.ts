import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Process, ProcessState } from "../process"
import { ProcessTypeConverter } from "../process_type"

const processType = "V8TestProcess"

export interface V8TestProcessState extends ProcessState {
}

export class V8TestProcess extends Process {
  public readonly processType = processType

  private constructor(
  ) {
    super()
  }

  public encode(): V8TestProcessState {
    return {
      t: ProcessTypeConverter.convert(this.processType),
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static decode(state: V8TestProcessState): V8TestProcess {
    return new V8TestProcess()
  }

  public static create(): V8TestProcess {
    return new V8TestProcess()
  }

  public shortDescription = (): string => {
    return ""
  }

  public run = (): void => {
    if (Game.time % 20 === 0) {
      PrimitiveLogger.log(`${this.constructor.name} run`)  // FixMe: 消す
    }
  }
}
