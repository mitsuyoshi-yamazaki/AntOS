import type { TaskIdentifier } from "application/task_identifier"
import type { TaskPerformance } from "application/task_profit"
import type { EconomyTaskPerformance } from "application/task_profit/economy_task_performance"
import type { ObserveTaskPerformance } from "application/task_profit/observe_task_performance"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { GameConstants } from "utility/constants"

export interface TaskPrioritizerTaskEstimation<Performance extends TaskPerformance> {
  taskIdentifier: TaskIdentifier
  estimate: Performance
}

export interface TaskPrioritizerPrioritizedTasks {
  taskIdentifiers: TaskIdentifier[]

  /** Spawn Requestを受理可能であるTask */
  executableTaskIdentifiers: TaskIdentifier[]
}

export class TaskPrioritizer {
  public prioritizeTasks(
    roomResource: OwnedRoomResource,
    economyTaskEstimation: TaskPrioritizerTaskEstimation<EconomyTaskPerformance>[],
    observeTaskEstimation: TaskPrioritizerTaskEstimation<ObserveTaskPerformance>[],
  ): TaskPrioritizerPrioritizedTasks {

    const tasks: TaskPrioritizerPrioritizedTasks = {
      taskIdentifiers: [],
      executableTaskIdentifiers: [],
    }

    let availableSpawnCapacity = GameConstants.creep.life.lifeTime * roomResource.activeStructures.spawns.length

    // TODO: 仮実装
    const checkEstimation = <Performance extends TaskPerformance>(estimation: TaskPrioritizerTaskEstimation<Performance>): void => {
      tasks.taskIdentifiers.push(estimation.taskIdentifier)
      if ((availableSpawnCapacity - estimation.estimate.spawnTime) > 0) {
        tasks.executableTaskIdentifiers.push(estimation.taskIdentifier)
        availableSpawnCapacity -= estimation.estimate.spawnTime
      }
    }

    economyTaskEstimation.forEach(estimation => checkEstimation(estimation))
    observeTaskEstimation.forEach(estimation => checkEstimation(estimation))

    return tasks
  }
}
