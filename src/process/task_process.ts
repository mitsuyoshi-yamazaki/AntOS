import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { roomLink } from "utility/log"
import { World } from "world_info/world_info"
import { decodeTaskFrom } from "v5_task/task_decoder"
import { ProcessState } from "./process_state"
import { Task } from "v5_task/task"
import { TaskState } from "v5_task/task_state"
import { isLaunchableTask, LaunchableTask } from "v5_task/launchable_task"
import { processLog } from "./process_log"

type TaskProcessTask = Task & LaunchableTask

export interface TaskProcessState extends ProcessState {
  /** task state */
  s: TaskState
}

export class TaskProcess implements Process, Procedural {
  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly task: TaskProcessTask,
  ) { }

  public encode(): TaskProcessState {
    return {
      t: "TaskProcess",
      l: this.launchTime,
      i: this.processId,
      s: this.task.encode(),
    }
  }

  public static decode(state: TaskProcessState): TaskProcess | null {
    const task = decodeTaskFrom(state.s)
    if (!(task instanceof Task) || !(isLaunchableTask(task))) {
      return null
    }
    return new TaskProcess(state.l, state.i, task)
  }

  public static create(processId: ProcessId, task: TaskProcessTask): TaskProcess {
    return new TaskProcess(Game.time, processId, task)
  }

  public processShortDescription(): string {
    return this.task.taskIdentifier
  }

  public runOnTick(): void {
    const objects = World.rooms.getOwnedRoomObjects(this.task.roomName)
    if (objects == null) {
      PrimitiveLogger.fatal(`${roomLink(this.task.roomName)} lost`)
      return
    }
    const result = this.task.run(objects)
    switch (result) {
    case "in progress":
      break
    case "finished":
      processLog(this, `Task ${this.task.taskIdentifier} finished`)
      break
    case "failed":
      processLog(this, `Task ${this.task.taskIdentifier} failed`)
      break
    }
  }
}
