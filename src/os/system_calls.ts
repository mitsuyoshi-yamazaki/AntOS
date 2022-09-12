/**
 # SystemCall
 ## 概要
 v2系OSの循環importを修正するための実装
 後付けであるためSystem Callがnullableであったり、直接OSを呼び出すコードが残っているなどの問題がある
 */

import type { Process, ProcessId } from "../process/process"
import type { ProcessInfo } from "./os_process_info"

type AddProcessType = <T extends Process>(parentProcessId: ProcessId | null, maker: (processId: ProcessId) => T) => T

type SystemCall = {
  readonly addProcess: AddProcessType
  readonly listAllProcesses: () => ProcessInfo[]
}
let systemCall: SystemCall | null = null

export const SystemCalls = {
  load(s: SystemCall): void {
    systemCall = s
  },

  systemCall(): SystemCall | null {
    return systemCall
  },
}
