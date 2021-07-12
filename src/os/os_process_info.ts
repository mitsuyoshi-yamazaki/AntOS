import type { Process } from "process/process"

export interface ProcessInfo {
  processId: number
  type: string
  running: boolean
  process: Process
}
