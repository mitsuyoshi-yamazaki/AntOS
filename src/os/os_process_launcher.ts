import { Process, ProcessId } from "process/process"

export type ProcessLauncher = (parentProcessId: ProcessId | null, launcher: (processId: ProcessId) => Process) => Process
