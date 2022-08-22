/**
 # RootProcess
 ## 概要
 v2系OSの最上位Process
 Application Processはこの直下に位置する

 ## 仕様
 最上位に位置するため親がいないなど性格が異なり、Processを継承するオブジェクトではない
 */

import { Process, ProcessId, ProcessRunner } from "./process"
import { ProcessType, ProcessTypeConverter, rootProcessId } from "./process_type"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { LaunchMessageObserver } from "./message_observer/launch_message_observer"
import { V8TestProcess } from "./temporary/v8_test_process"

export class RootProcess implements LaunchMessageObserver {
  public readonly processId = rootProcessId

  public constructor() {}

  /** @throws */
  public didReceiveLaunchMessage(processType: ProcessType): Process {
    switch (processType) {
    case "V8TestProcess":
      return V8TestProcess.create()
    default:
      throw ""
    }
  }

  public run(): void {
    if (Game.time % 20 === 0) {
      PrimitiveLogger.log("v8 RootProcess.run()")  // FixMe: 消す
    }
  }
}
