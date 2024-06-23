import type { Mutable } from "shared/utility/types"
import { SystemCall } from "../../system_call"
import { Environment } from "../environment"
import { ProcessManager } from "../process_manager/process_manager"
import { UniqueId } from "../unique_id"
import { AnyDeferredTask, AnyDeferredTaskState, DeferredTask, DeferredTaskErrorReasons, DeferredTaskId, deferredTaskPriority, DeferredTaskPriority, DeferredTaskResult, DeferredTaskState } from "./deferred_task"
import { PrimitiveLogger } from "shared/utility/logger/primitive_logger"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import type { AnyProcess, AnyProcessId } from "os_v5/process/process"
import type { Timestamp } from "shared/utility/timestamp"


type DeferredTaskManagerMemory = {
  readonly tasks: AnyDeferredTaskState[]
}

const initializeMemory = (memory: DeferredTaskManagerMemory): DeferredTaskManagerMemory => {
  const mutableMemroy = memory as Mutable<DeferredTaskManagerMemory>

  if (mutableMemroy.tasks == null) {
    mutableMemroy.tasks = []
  }

  return mutableMemroy
}

let deferredTaskManagerMemory = {} as DeferredTaskManagerMemory
const tasks: AnyDeferredTask[] = []
const restoredTasks: AnyDeferredTaskState[] = []
let runningTask: AnyDeferredTask | null = null

type DeferredTaskManager = {
  register<TaskType extends string, T>(processId: AnyProcessId, taskType: TaskType, task: () => T, options?: { expiredBy?: Timestamp, priority: DeferredTaskPriority}): DeferredTaskId
}

export const DeferredTaskManager: SystemCall<"DeferredTaskManager", DeferredTaskManagerMemory> & DeferredTaskManager = {
  name: "DeferredTaskManager",
  [Symbol.toStringTag]: "DeferredTaskManager",

  load(memory: DeferredTaskManagerMemory): void {
    deferredTaskManagerMemory = initializeMemory(memory)
    restoredTasks.push(...deferredTaskManagerMemory.tasks)
  },

  startOfTick(): void {
  },

  endOfTick(): DeferredTaskManagerMemory {
    if (Environment.isServerRestarted() === true) {
      notifyTaskFailureByServerRestart()
      restoredTasks.splice(0, restoredTasks.length)
    }

    if (runningTask != null) {
      notifyTaskFailureByTermination(runningTask)
      runningTask = null
    }

    runTasks()

    // TODO: expirationチェック

    const taskStates: AnyDeferredTaskState[] = [
      ...tasks.map(task => ({ // Memoryに保存できないプロパティを除外
        id: task.id,
        processId: task.processId,
        taskType: task.taskType,
      })),
      ...restoredTasks,
    ]
    return {
      tasks: taskStates,
    }
  },

  // DeferredTaskManager
  register<TaskType extends string, T>(processId: AnyProcessId, taskType: TaskType, task: () => T, options?: { expiredBy?: Timestamp, priority: DeferredTaskPriority }): DeferredTaskId {
    const taskId: DeferredTaskId = UniqueId.generate()
    tasks.push({
      id: taskId,
      processId,
      taskType,
      priority: options?.priority ?? deferredTaskPriority.low,
      expiredBy: options?.expiredBy ?? null,
      task,
    })
    tasks.sort((lhs, rhs) => lhs.priority - rhs.priority)

    return taskId
  },
}


const runTasks = (): void => {
  const cpu = Game.cpu.getUsed()
  if (Game.cpu.bucket < 9500 || (cpu > Game.cpu.limit)) {
    return
  }
  const task = tasks.shift()
  if (task == null) {
    return
  }
  const process = ProcessManager.getProcess(task.processId)
  if (process == null) {
    log(`Process ${task.processId} was terminated (task: ${task.taskType})`)
    return
  }
  if (process.didFinishDeferredTask == null) {
    noReceiverMethodErrorLog(process, task.taskType)
    return
  }

  runningTask = task

  try {
    const result = runTask(task)

    log(`Task ${task.taskType} for ${process} took ${Game.cpu.getUsed() - cpu} cpu`)

    process.didFinishDeferredTask(result)

  } catch (error) {

    const result: DeferredTaskResult<string, void> = {
      id: task.id,
      taskType: task.taskType,
      result: {
        case: "failed",
        error: {
          case: "error raised",
          error,
        },
      },
    }
    process.didFinishDeferredTask(result)
    logError(`Task ${task.taskType} for ${process} raises an error ${error}`)
  }

  runningTask = null
}

/** @throws */
const runTask = <TaskType extends string, T>(task: DeferredTask<TaskType, T>): DeferredTaskResult<TaskType, T> => {
  const resultValue = task.task()
  return {
    id: task.id,
    taskType: task.taskType,
    result: {
      case: "succeeded",
      value: resultValue,
    },
  }
}

const notifyTaskFailureByTermination = <TaskType extends string, T>(task: DeferredTask<TaskType, T>): void => {
  notifyTaskFailure(task, "task terminated")
  logError(`Task ${task.taskType} for ${task.processId} was terminated`)
}

const notifyTaskFailureByServerRestart = (): void => {
  restoredTasks.forEach(<TaskType extends string>(restoredTask: DeferredTaskState<TaskType>): void => {
    notifyTaskFailure(restoredTask, "server restarted")
    logWarn(`Task ${restoredTask.taskType} for ${restoredTask.processId} was canceled by server restart`)
  })
}

const notifyTaskFailure = <TaskType extends string>(task: DeferredTaskState<TaskType>, failureReason: Exclude<DeferredTaskErrorReasons, "error raised">): void => {
  const process = ProcessManager.getProcess(task.processId)
  if (process == null) {
    return
  }
  if (process.didFinishDeferredTask == null) {
    noReceiverMethodErrorLog(process, task.taskType)
    return
  }

  const taskResult: DeferredTaskResult<TaskType, void> = {
    id: task.id,
    taskType: task.taskType,
    result: {
      case: "failed",
      error: {
        case: failureReason,
      },
    },
  }
  process.didFinishDeferredTask(taskResult)
}

const log = (message: string): void => {
  PrimitiveLogger.log(`${ConsoleUtility.colored("DeferredTaskManager", "info")} ${message}`)
}

const logWarn = (message: string): void => {
  PrimitiveLogger.log(`${ConsoleUtility.colored("DeferredTaskManager", "warn")} ${message}`)
}

const logError = (message: string): void => {
  PrimitiveLogger.fatal(`${ConsoleUtility.colored("DeferredTaskManager", "error")} ${message}`)
}

const noReceiverMethodErrorLog = (process: AnyProcess, taskType: string): void => {
  PrimitiveLogger.programError(`${ConsoleUtility.colored("DeferredTaskManager", "info")} Process ${process} does not have didFinishDeferredTask() (taskType: ${taskType})`)
}
