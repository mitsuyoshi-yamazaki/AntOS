import { ErrorMapper } from "error_mapper/ErrorMapper"
import { AnyProcessId } from "os_v5/process/process"
import { SystemCall } from "os_v5/system_call"
import { EmptySerializable } from "os_v5/utility/types"
import { ValuedArrayMap } from "shared/utility/valued_collection"

// ScheduledStaticTaskManagerで管理することのオーバーヘッドがあるため、短期間の定期処理は行わない
type ScheduledStaticTaskInterval = "100" | "1000" | "10000" | "50000"

type ScheduledStaticTaskManager = {
  add(processId: AnyProcessId, interval: ScheduledStaticTaskInterval, task: () => void, options?: {canSkip?: 1|2|4}): void
}

type TaskId = number
type Task = {
  readonly taskId: TaskId
  readonly processId: AnyProcessId
  readonly interval: ScheduledStaticTaskInterval
  readonly task: () => void
  readonly canSkip: 0|1|2|4
}

let taskIdIndex = 0
const taskQueue: Task[] = []
const taskIdsInQueue = new Set<TaskId>()
const allTasks = new ValuedArrayMap<ScheduledStaticTaskInterval, Task>()


export const ScheduledStaticTaskManager: SystemCall<"ScheduledStaticTaskManager", EmptySerializable> & ScheduledStaticTaskManager = {
  name: "ScheduledStaticTaskManager",
  [Symbol.toStringTag]: "ScheduledStaticTaskManager",

  load(): void {
  },

  startOfTick(): void {
  },

  endOfTick(): EmptySerializable {
    if (Game.time % 97 === 0) {
      addTasksToQueue(allTasks.getValueFor("100"))
    }
    if (Game.time % 997 === 0) {
      addTasksToQueue(allTasks.getValueFor("1000"))
    }
    if (Game.time % 9973 === 0) {
      addTasksToQueue(allTasks.getValueFor("10000"))
    }
    if (Game.time % 49999 === 0) {
      addTasksToQueue(allTasks.getValueFor("50000"))
    }

    runTasks()

    return {}
  },

  // ScheduledStaticTaskManager
  add(processId: AnyProcessId, interval: ScheduledStaticTaskInterval, task: () => void, options?: { canSkip?: 1 | 2 | 4 }): void {
    allTasks.getValueFor(interval).push({
      taskId: taskIdIndex,
      processId,
      interval,
      task,
      canSkip: options?.canSkip ?? 0,
    })

    taskIdIndex += 1
  },
}

const addTasksToQueue = (tasks: Task[]): void => {
  tasks.forEach(task => {
    if (taskIdsInQueue.has(task.taskId) === true) {
      return
    }
    taskIdsInQueue.add(task.taskId)
    taskQueue.push(task)
  })
}

const runTasks = (): void => {
  if (taskQueue.length <= 0) {
    return
  }
  if (Game.cpu.bucket < 9500) {
    return
  }

  const cpuLimit = Game.cpu.limit

  for (const task of taskQueue) {
    if (cpuLimit - Game.cpu.getUsed() < 20) {
      return
    }
    ErrorMapper.wrapLoop((): void => {
      task.task()
    }, `ScheduledStaticTaskManager.runTasks(${task.processId}, interval: ${task.interval})`)()
  }
}
