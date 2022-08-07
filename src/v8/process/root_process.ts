import { ProcessId } from "./process"
import { LaunchMessageObserver } from "./message_observer/launch_message_observer"

import { V8TestProcess } from "./temporary/v8_test_process"
import { ProcessType, rootProcessId } from "./process_type"
import { AnyProcess } from "./any_process"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"

export class RootProcess implements LaunchMessageObserver {
  public readonly processType = "RootProcess"
  public readonly processId: ProcessId = rootProcessId

  /** @throws */
  didReceiveLaunchMessage(processType: ProcessType): (processId: ProcessId) => AnyProcess {
    switch (processType) {
    case "V8TestProcess":
      return processId => V8TestProcess.create(processId)
    default:
      throw `cannot launch ${processType}`
    }
  }

  public run(): void {
    if (Game.time % 20 === 0) {
      PrimitiveLogger.log("v8 RootProcess.run()")  // FixMe: 消す
    }
  }
}
