// // 一旦RoomKeeperでチェックしているので忘れる
// import { OwnedRoomEnergyAvailableObjective } from "objective/energy_stored/owned_room_energy_available_objective"
// import { Objective } from "objective/objective"
// import { Problem } from "objective/problem"
// import { TaskRunner } from "objective/task_runner"
// import { OwnedRoomWorkTaskRunner } from "objective/worker/owned_room_worker_task_runner"
// import { OwnedRoomObjects } from "world_info/room_info"

// export class UpgradeControllerObjective implements Objective {
//   public readonly children: Objective[]

//   public constructor(
//     public readonly objects: OwnedRoomObjects,
//   ) {
//     this.children = [
//       new OwnedRoomEnergyAvailableObjective(this.objects),
//       new OwnedRoomCreepExistsObjective(this.objects, [CreepRole.Worker, CreepRole.Mover], 8 * this.objects.sources.length),
//     ]
//   }

//   public taskRunners(): TaskRunner[] {
//     const taskRunners: TaskRunner[] = [
//       new OwnedRoomWorkTaskRunner(this.objects),
//     ]
//     taskRunners.push(...this.children.flatMap(child => child.taskRunners()))
//     return taskRunners
//   }

//   public currentProblems(): Problem[] {
//     return this.children.flatMap(child => child.currentProblems())
//   }
// }
