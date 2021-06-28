import { ProcessId } from "objective/process"

export interface RuntimeMemory {
  processLogs: ProcessLog[]
}

export interface ProcessLog {
  processId: ProcessId
  processType: string
  message: string
}
