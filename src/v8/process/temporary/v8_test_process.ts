import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Process, ProcessState } from "../process"
import { ProcessDecoder } from "../process_decoder"
import { ProcessTypeConverter } from "../process_type"

const processType = "V8TestProcess"
ProcessDecoder.register(ProcessTypeConverter.convert(processType), state => V8TestProcess.decode(state as V8TestProcessState))

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

  public static decode(state: V8TestProcessState): V8TestProcess {
    return new V8TestProcess()
  }

  public static create(): V8TestProcess {
    return new V8TestProcess()
  }

  public shortDescription = (): string => {
    return this.constructor.name
  }

  public run = (): void => {
    if (Game.time % 20 === 0) {
      PrimitiveLogger.log(`${this.constructor.name} run`)  // FixMe: 消す
    }
  }
}
