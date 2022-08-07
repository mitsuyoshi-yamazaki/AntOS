import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Process, ProcessId, ProcessState } from "../process"
import { ShortV8TestProcessType } from "../process_type"

export interface V8TestProcessState extends ProcessState {
  readonly t: ShortV8TestProcessType
}

export class V8TestProcess implements Process<void, void, void, void> {
  public readonly processType = "V8TestProcess"

  private constructor(
    public readonly processId: ProcessId,
  ) {
  }

  public encode(): V8TestProcessState {
    return {
      i: this.processId,
      t: "a",
    }
  }

  public static decode(state: V8TestProcessState): V8TestProcess {
    return new V8TestProcess(state.i)
  }

  public static create(processId: ProcessId): V8TestProcess {
    return new V8TestProcess(processId)
  }

  public run(): void {
    if (Game.time % 20 === 0) {
      PrimitiveLogger.log(`${this.constructor.name} run`)  // FixMe: 消す
    }
  }
}
