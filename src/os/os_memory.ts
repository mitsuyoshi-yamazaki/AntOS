import type { LoggerMemory } from "./infrastructure/logger"
import type { ProcessState } from "process/process_state"
import type { ProcessId } from "process/process"

export interface ProcessMemory {
  /** running */
  readonly r: boolean

  /** process state */
  readonly s: ProcessState

  readonly childProcessIds: ProcessId[]
  readonly executionPriority: number
}

export interface OSMemory {
  p: ProcessMemory[]  // processes (stateless)
  config: {
    /** 毎tickメモリ呼び出しを行う: ProcessStateを手動で編集することが可能になる */
    shouldReadMemory?: boolean
  }
  logger: LoggerMemory
  enabledDrivers: {
    swcAllyRequest: boolean
  },
}
