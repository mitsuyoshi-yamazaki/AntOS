/**
 # SystemCall
 ## 概要
 v2系OSの循環importを修正するための実装
 後付けであるためSystem Callがnullableであったり、直接OSを呼び出すコードが残っているなどの問題がある
 */

import type { Result } from "shared/utility/result"
import type { Process, ProcessId } from "../process/process"
import { PrimitiveLogger } from "./infrastructure/primitive_logger"
import type { ProcessInfo } from "./os_process_info"

type AddProcessType = <T extends Process>(parentProcessId: ProcessId | null, maker: (processId: ProcessId) => T) => T

type SystemCall = {
  readonly addProcess: AddProcessType
  readonly listAllProcesses: () => ProcessInfo[]
  readonly suspendProcess: (processId: ProcessId) => Result<string, string>
  readonly killProcess: (processId: ProcessId) => Result<string, string>
  readonly processOf: (processId: ProcessId) => Process | null
}
let systemCall: SystemCall | null = null

export const SystemCalls = {
  load(s: SystemCall): void {
    systemCall = s
  },

  systemCall(): SystemCall | null {
    if (systemCall == null) {
      PrimitiveLogger.programError("SystemCalls.systemCall is null")
    }
    return systemCall
  },
}
