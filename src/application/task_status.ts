import type { TaskRequests } from "./task_requests"

interface TaskStatusInProgress {
  taskStatusType: "in progress"
  taskRequests: TaskRequests
}
interface TaskStatusFinished {
  taskStatusType: "finished"
}
interface TaskStatusFailed {
  taskStatusType: "failed"
  taskRequests: TaskRequests
}
export type TaskStatus = TaskStatusInProgress | TaskStatusFinished | TaskStatusFailed
export const TaskStatus = {
  InProgress(taskRequests: TaskRequests): TaskStatusInProgress {
    return {
      taskStatusType: "in progress",
      taskRequests,
    }
  },
  Finished(): TaskStatusFinished {
    return {
      taskStatusType: "finished",
    }
  },
  Failed(taskRequests: TaskRequests): TaskStatusFailed {
    return {
      taskStatusType: "failed",
      taskRequests,
    }
  },
}
