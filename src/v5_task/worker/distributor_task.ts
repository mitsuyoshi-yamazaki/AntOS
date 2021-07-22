// import { ProblemFinder } from "problem/problem_finder"
// import { RoomName } from "utility/room_name"
// import { ChildTaskExecutionResults, Task, TaskIdentifier, TaskStatus } from "v4_task/task"
// import { OwnedRoomObjects } from "world_info/room_info"
// import { GeneralCreepWorkerTask, GeneralCreepWorkerTaskCreepRequest, GeneralCreepWorkerTaskState } from "v4_task/general/general_creep_worker_task"
// import { CreepTask } from "object_task/creep_task/creep_task"
// import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
// import { CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
// import { generateCodename } from "utility/unique_id"
// import { MoveClaimControllerTask } from "object_task/creep_task/combined_task/move_claim_controller_task"
// import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
// import { World } from "world_info/world_info"
// import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
// import { EnergySource } from "prototype/room_object"
// import { UPGRADE_CONTROLLER_RANGE } from "utility/constants"

// export interface DistributorTaskState extends GeneralCreepWorkerTaskState {
//   /** room name */
//   r: RoomName
// }

// export class DistributorTask extends GeneralCreepWorkerTask {
//   public readonly taskIdentifier: TaskIdentifier

//   private readonly codename: string

//   private constructor(
//     public readonly startTime: number,
//     public readonly children: Task[],
//     public readonly roomName: RoomName,
//   ) {
//     super(startTime, children, roomName)

//     this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
//     this.codename = generateCodename(this.taskIdentifier, this.startTime)
//   }

//   public encode(): DistributorTaskState {
//     return {
//       t: "DistributorTask",
//       s: this.startTime,
//       c: this.children.map(task => task.encode()),
//       r: this.roomName,
//     }
//   }

//   public static decode(state: DistributorTaskState, children: Task[]): DistributorTask {
//     return new DistributorTask(state.s, children, state.r)
//   }

//   public static create(roomName: RoomName): DistributorTask {
//     const upgraderPositions: RoomPosition[] = []
//     const energySources: DistributorTaskEnergySource[] = []
//     const objects = World.rooms.getOwnedRoomObjects(roomName)
//     if (objects != null) {
//       const controller = objects.controller
//       const container = controller.pos.findInRange(FIND_STRUCTURES, UPGRADE_CONTROLLER_RANGE).find(structure => structure.structureType === STRUCTURE_CONTAINER) as StructureContainer | null
//       if (container != null) {
//         energySources.push(container)
//       }
//       const link = controller.pos.findInRange(FIND_STRUCTURES, UPGRADE_CONTROLLER_RANGE).find(structure => structure.structureType === STRUCTURE_LINK) as StructureLink | null
//       if (link != null) {
//         energySources.push(link)
//       }
//       // upgraderPositions =  // TODO:
//     }
//     const energySourceIds = energySources.map(energySource => energySource.id)
//     return new DistributorTask(Game.time, [], roomName, [], energySourceIds)
//   }

//   public runTask(objects: OwnedRoomObjects, childTaskResults: ChildTaskExecutionResults): TaskStatus {
//     super.runTask(objects, childTaskResults)

//     const problemFinders: ProblemFinder[] = [
//     ]
//     this.checkProblemFinders(problemFinders)

//     return TaskStatus.InProgress
//   }

//   public creepFileterRoles(): CreepRole[] | null {
//     return [CreepRole.Claimer]
//   }

//   public creepRequest(): GeneralCreepWorkerTaskCreepRequest | null {
//     return {
//       necessaryRoles: [CreepRole.Claimer],
//       taskIdentifier: this.taskIdentifier,
//       numberOfCreeps: 1,
//       codename: this.codename,
//       initialTask: creepTask,
//       priority: CreepSpawnRequestPriority.Medium,
//       body: null
//     }
//   }

//   public newTaskFor(creep: Creep, objects: OwnedRoomObjects): CreepTask | null {
//     if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
//       return a
//     }
//   }
// }
