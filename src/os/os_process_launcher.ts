import { Process, ProcessId } from "process/process"

export type ProcessLauncher = (launcher: (processId: ProcessId) => Process) => Process
