import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { RoomResources } from "room_resource/room_resources"
import { GameConstants } from "utility/constants"
import { RoomName } from "utility/room_name"
import { FleeFromSKLairTask } from "v5_object_task/creep_task/combined_task/flee_from_sk_lair_task"
import { SequentialTask } from "v5_object_task/creep_task/combined_task/sequential_task"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { World } from "world_info/world_info"

type ObserveDeclaration = {
  readonly declarationType: "observe"
  readonly targetRoomName: RoomName
  readonly duration: "once"
}
type GuardDeclarationTargetRoom = {
  readonly targetType: "room"
  readonly roomName: RoomName
}
type GuardDeclarationTargetType = GuardDeclarationTargetRoom
type GuardDeclarationHostileSourceKeeper = {
  readonly hostileType: "source keeper"
}
type GuardDeclarationHostileType = GuardDeclarationHostileSourceKeeper
type GuardDeclaration = {
  readonly declarationType: "guard"
  readonly target: GuardDeclarationTargetType

  /** 防御対象。攻撃対象ではない */
  readonly hostileType: GuardDeclarationHostileType
}
type Declaration = ObserveDeclaration | GuardDeclaration

type SpawnRequest = {
  readonly requestType: "spawn"
  readonly body: BodyPartConstant[]
}
type ActionRequest = {
  readonly requestType: "action"
  readonly action: "build"
}
type Request = SpawnRequest | ActionRequest

export interface SKHarvestingProcessState extends ProcessState {
  readonly targetRoomName: RoomName
}

// Game.io("launch SKHarvestingProcess target_room_name=W54S6")
export class SKHarvestingProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly targetRoomName: RoomName,
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): SKHarvestingProcessState {
    return {
      t: "SKHarvestingProcess",
      l: this.launchTime,
      i: this.processId,
      targetRoomName: this.targetRoomName,
    }
  }

  public static decode(state: SKHarvestingProcessState): SKHarvestingProcess {
    return new SKHarvestingProcess(state.l, state.i, state.targetRoomName)
  }

  public static create(processId: ProcessId, targetRoomName: RoomName): SKHarvestingProcess {
    return new SKHarvestingProcess(Game.time, processId, targetRoomName)
  }

  public runOnTick(): void {
    // const availableRooms = this.nearestAvailableRooms()

    // const room = Game.rooms[this.targetRoomName]
    // if (room == null) { // <- declarativeにする
    //   const availableRoom = availableRooms[0]
    //   if (availableRoom != null) {
    //     this.observeRoom(availableRoom) // TODO: Request化
    //   }
    //   return
    // }

    // const noSpawn = ((): boolean => {
    //   const invaderCore = room.find(FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_INVADER_CORE } })[0] as StructureInvaderCore | null
    //   if (invaderCore == null) {
    //     return false
    //   }
    //   if (invaderCore.ticksToDeploy == null) {
    //     return true
    //   }
    //   if (invaderCore.ticksToDeploy < (GameConstants.creep.life.lifeTime / 2)) {
    //     return true
    //   }
    //   return false
    // })()

    // if (this.roadLayoutExists() !== true) {
    //   this.layoutRoads()
    // }

    // this.placeMissingRoads()

    // // creep request/action request
  }

  // private addRequest(request: Request): void {

  // }

  // private placeMissingRoads(): void {

  // }

  // private layoutRoads(): void {

  // }

  // private roadLayoutExists(): boolean {

  // }

  // private observeRoomRequest(parentRoom: Room): void {
  //   const observerCreepName = `${this.targetRoomName}observer`
  //   if (Game.creeps[observerCreepName] != null) {
  //     return
  //   }

  //   const tasks: CreepTask[] = [
  //     MoveToRoomTask.create(this.targetRoomName, []),
  //     MoveToTask.create(new RoomPosition(25, 25, this.targetRoomName), 10),
  //   ]
  //   const initialTask = FleeFromSKLairTask.create(SequentialTask.create(tasks, { ignoreFailure: false, finishWhenSucceed: false }))

  //   World.resourcePools.addSpawnCreepRequest(parentRoom.name, {
  //     priority: CreepSpawnRequestPriority.Low,
  //     numberOfCreeps: 1,
  //     codename: observerCreepName,
  //     roles: [CreepRole.Scout],
  //     body: [MOVE],
  //     initialTask: initialTask,
  //     taskIdentifier: this.taskIdentifier,
  //     parentRoomName: null,
  //     name: observerCreepName,
  //   })
  // }

  // private nearestAvailableRooms(): Room[] {
  //   // TODO:
  //   const targetRoomInfo = RoomResources.getRoomInfo(this.targetRoomName)
  //   if (targetRoomInfo == null) {
  //     return []
  //   }
  //   return targetRoomInfo.neighbourRoomNames.flatMap(neighbourRoomName => {
  //     const resources = RoomResources.getOwnedRoomResource(neighbourRoomName)
  //     if (resources == null) {
  //       return []
  //     }
  //     return resources.room
  //   })
  // }
}
