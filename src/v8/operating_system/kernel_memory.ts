import type { ProcessId, ProcessState } from "v8/process/process"

export type KernelMemory = {
  enabled: boolean  // FixMe: 前バージョンの動作を妨げないためのもの：運用開始したら消す

  process: ProcessManagerMemory
}

type ProcessManagerMemory = {
  processIdIndex: number
  processInfoMemories: {[ParentProcessId: string]: ProcessInfoMemory[]}
}

export type ProcessInfoMemory = {
  /// process ID
  readonly i: ProcessId

  /// running
  readonly r: boolean

  /// process state
  readonly s: ProcessState
}
