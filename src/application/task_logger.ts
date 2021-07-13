import type { TaskIdentifier } from "./task_identifier"

type TaskLogEventType = "task added" | "task finished" | "found problem"

export interface TaskLogRequest {
  taskIdentifier: TaskIdentifier
  logEventType: TaskLogEventType
  message: string
}
