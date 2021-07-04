import { State, Stateful } from "os/infrastructure/state"
import { RoomName } from "prototype/room"
import { CreepTask } from "task/creep_task/creep_task"
import { World } from "world_info/world_info"


//
export type ObjectiveStatus<FailureReason> = "ok" | FailureReason

// export interface ObjectiveState extends State {

// }

export interface Objective<T> {
  status(): "ok" | "ng"
  possibleSolutions(): T[]
}

export interface AbstractObjective extends Objective<T> {

}

export interface ConcreteObjective extends Objective {

}

export type ObserveRoomObjectiveFailureReason = "no visual"
export type ObserveRoomObjectiveStatus = ObjectiveStatus<ObserveRoomObjectiveFailureReason>

export class ObserveOwnedRoomAdjacentRoomObjective implements Objective {
  public currentState(targetRoomName: RoomName): ObserveRoomObjectiveStatus {
    const targetRoom = World.rooms.get(targetRoomName)
    if (targetRoom) {
      return "ok"
    }
    return "no visual"
  }

  public possibleSolutionsFor(reason: ObserveRoomObjectiveFailureReason): Objective[] {
    return [
      new ScoutRoomObjective(),
    ]
  }
}

/**
 * - 目的：
 */
export class ObserveRoomObjective implements Objective {
  public currentState(targetRoomName: RoomName): ObserveRoomObjectiveStatus {
    const targetRoom = World.rooms.get(targetRoomName)
    if (targetRoom) {
      return "ok"
    }
    return "no visual"
  }

  public possibleSolutionsFor(reason: ObserveRoomObjectiveFailureReason): Objective[] {
    return [
      new ScoutRoomObjective(),
    ]
  }
}

export class ScoutRoomObjective implements Objective {
  public currentState(targetRoomName: RoomName, scout: Creep): ObjectiveStatus<"moving"> {
    if (scout.room.name === targetRoomName) {
      return "ok"
    }
    return "moving"
  }

  public possibleSolutionsFor(reason: ObserveRoomObjectiveFailureReason, scout: Creep): CreepTask {

  }
}

/**
 * - 目的：
 *   - Sourceを枯渇させる
 *     - Source.targetedBy
 *   - 生きているworkerを働かせる
 */
// export class PrimitiveWorkerObjective implements Objective {

// }
