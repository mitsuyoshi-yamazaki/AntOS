// import { CreepTask, CreepTaskState } from "game_object_task/creep_task"
// import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"
// import { RoomName } from "prototype/room"

// export interface PatrolRoomTaskState extends CreepTaskState {
//   /** target room name */
//   r: RoomName
// }

// export class PatrolRoomTask implements CreepTask {
//   public readonly shortDescription = "patrol"
//   // public get targetId(): RoomName {
//   //   return this.roomName
//   // }

//   public constructor(
//     public readonly startTime: number,
//     public readonly roomName: RoomName,
//   ) { }

//   public encode(): PatrolRoomTaskState {
//     return {
//       s: this.startTime,
//       t: "PatrolRoomTask",
//       r: this.roomName,
//     }
//   }

//   public static decode(state: PatrolRoomTaskState): PatrolRoomTask | null {
//     return new PatrolRoomTask(state.s, state.r)
//   }

//   public run(creep: Creep): GameObjectTaskReturnCode {

//     return "failed" // TODO: 途中

//     // const hostileCreep = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3).filter(c => {
//     //   return Game.isEnemy(c)
//     // })
//     // if (hostileCreep == null) {
//     //   if () {

//     //   }
//     // }

//     // switch (result) {
//     // case OK: {
//     //   const consumeAmount = creep.body.filter(b => b.type === WORK).length * BUILD_POWER
//     //   if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= consumeAmount) {
//     //     return "finished"
//     //   }
//     //   return "in progress"
//     // }
//     // case ERR_NOT_IN_RANGE:
//     //   creep.moveTo(this.constructionSite, { reusePath: 0 })
//     //   return "in progress"
//     // case ERR_NOT_ENOUGH_RESOURCES:
//     //   return "finished"
//     // case ERR_NOT_OWNER:
//     // case ERR_INVALID_TARGET:
//     // case ERR_NO_BODYPART:
//     //   return "failed"
//     // case ERR_BUSY:
//     // default:
//     //   return "in progress"
//     // }
//   }
// }
