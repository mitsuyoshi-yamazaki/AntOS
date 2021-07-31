import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { CreepSpawnTaskEvent, isCreepSpawnTaskEventHandler } from "./task_event"
import { TaskIdentifier } from "./task_identifier"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTask = {identifier: TaskIdentifier}

interface TaskManagerInterface {
  addTask(task: AnyTask): void

  // ---- Event Handler ---- //
  didSpawnCreep(taskIdentifier: TaskIdentifier, creepSpawnEvent: CreepSpawnTaskEvent): void
  didCancelSpawningCreep(taskIdentifier: TaskIdentifier, creepSpawnEvent: CreepSpawnTaskEvent): void
}

const tasks = new Map<TaskIdentifier, AnyTask>()

export const TaskManager: TaskManagerInterface = {
  addTask(task: AnyTask): void {
    tasks.set(task.identifier, task)
  },

  // ---- Event Handler ---- //
  didSpawnCreep(taskIdentifier: TaskIdentifier, creepSpawnEvent: CreepSpawnTaskEvent): void {
    const task = tasks.get(taskIdentifier)
    if (task == null) {
      PrimitiveLogger.programError(`TaskManager.didSpawnCreep() no task with identifier ${taskIdentifier}`)
      return
    }
    if (!isCreepSpawnTaskEventHandler(task)) {
      return  // Creepは生成するがその後関知しないということもありうる
    }
    task.didSpawnCreep(creepSpawnEvent)
  },

  didCancelSpawningCreep(taskIdentifier: TaskIdentifier, creepSpawnEvent: CreepSpawnTaskEvent): void {
    const task = tasks.get(taskIdentifier)
    if (task == null) {
      PrimitiveLogger.programError(`TaskManager.didSpawnCreep() no task with identifier ${taskIdentifier}`)
      return
    }
    if (!isCreepSpawnTaskEventHandler(task)) {
      return  // Creepは生成するがその後関知しないということもありうる
    }
    task.didCancelSpawningCreep(creepSpawnEvent)
  },
}
