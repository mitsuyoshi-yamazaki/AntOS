import { TaskTarget } from "object_task/object_task_target_cache"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { RoomName } from "utility/room_name"
import { SquadTask, SquadTaskProgress } from "../squad_task"
import { SquadTaskState } from "../squad_task_state"

export interface MoveToRoomSquadTaskState extends SquadTaskState {
  /** type identifier */
  t: "MoveToRoomSquadTask"

  destinationRoomName: RoomName
  waypoints: RoomName[]
}

export class MoveToRoomSquadTask extends SquadTask {
  protected constructor(
    startTime: number,
    public readonly destinationRoomName: RoomName,
    public readonly waypoints: RoomName[],
  ) {
    super(startTime)
  }

  public encode(): MoveToRoomSquadTaskState {
    return {
      t: "MoveToRoomSquadTask",
      s: this.startTime,
      destinationRoomName: this.destinationRoomName,
      waypoints: this.waypoints,
    }
  }

  public static decode(state: MoveToRoomSquadTaskState): MoveToRoomSquadTask {
    const exitPosition = ((): RoomPosition | null => {
    return new MoveToRoomSquadTask(state.s, state.destinationRoomName, state.waypoints)
  }

  public static create(destinationRoomName: RoomName, waypoints: RoomName[]): MoveToRoomSquadTask {
    return new MoveToRoomSquadTask(Game.time, destinationRoomName, waypoints)
  }

  public taskTargets(): TaskTarget[] {
    return [] // TODO:
  }

  public run(): SquadTaskProgress {
    return SquadTaskProgress.InProgress([]) // TODO:
  }
}
