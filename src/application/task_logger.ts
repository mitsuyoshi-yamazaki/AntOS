import type { TaskIdentifier } from "./task"

export type TaskLoggerEventType = "task added" | "task finished" | "found problem"

export type TaskLogger = (taskIdentifier: TaskIdentifier, eventType: TaskLoggerEventType, message: string) => void
