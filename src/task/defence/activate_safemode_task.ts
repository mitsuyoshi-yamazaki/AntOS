// TODO: There is another room in safe mode already などが考慮されていない

// import { ProblemIdentifier } from "problem/problem_finder"
// import { RoomName } from "prototype/room"
// import { Task, TaskState, TaskStatus } from "task/task"
// import { decodeTasksFrom } from "task/task_decoder"
// import { OwnedRoomObjects } from "world_info/room_info"

// export interface ActivateSafemodeTaskState extends TaskState {
//   /** room name */
//   r: RoomName
// }

// export class ActivateSafemodeTask extends Task {
//   private constructor(
//     public readonly startTime: number,
//     public readonly children: Task[],
//     public readonly problemIdentifier: ProblemIdentifier | null,
//     public readonly roomName: RoomName,
//   ) {
//     super(startTime, children, problemIdentifier)
//   }

//   public encode(): ActivateSafemodeTaskState {
//     return {
//       t: "ActivateSafemodeTask",
//       s: this.startTime,
//       c: this.children.map(task => task.encode()),
//       r: this.roomName,
//     }
//   }

//   public static decode(state: ActivateSafemodeTaskState): ActivateSafemodeTask {
//     const children = decodeTasksFrom(state.c)
//     return new ActivateSafemodeTask(state.s, children, state.i, state.r)
//   }

//   public static create(roomName: RoomName, problemIdentifier: ProblemIdentifier | null): ActivateSafemodeTask {
//     return new ActivateSafemodeTask(Game.time, [], problemIdentifier, roomName)
//   }

//   public runTask(objects: OwnedRoomObjects): TaskStatus {
//     const controller = objects.controller
//     const isActivatedSafemode = controller.safeMode != null
//     if (isActivatedSafemode) {
//       return TaskStatus.Finished
//     }
//     if (controller.safeModeAvailable <= 0) {
//       return TaskStatus.Failed
//     }
//     const cooldown = controller.safeModeCooldown
//     if (cooldown != null) {
//       if (cooldown > 150) {
//         return TaskStatus.Failed
//       }
//     }
//     controller.activateSafeMode()

//     return TaskStatus.InProgress
//   }
// }
