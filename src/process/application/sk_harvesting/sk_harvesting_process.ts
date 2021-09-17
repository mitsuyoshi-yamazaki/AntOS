import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { RoomResources } from "room_resource/room_resources"
import { RoomName } from "utility/room_name"
import { FleeFromSKLairTask } from "v5_object_task/creep_task/combined_task/flee_from_sk_lair_task"
import { SequentialTask } from "v5_object_task/creep_task/combined_task/sequential_task"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { World } from "world_info/world_info"

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
    const availableRooms = this.nearestAvailableRooms()

    const room = Game.rooms[this.targetRoomName]
    if (room == null) {
      const availableRoom = availableRooms[0]
      if (availableRoom != null) {
        this.observeRoom(availableRoom) // TODO: Request化
      }
      return
    }


  }

  private observeRoom(parentRoom: Room): void {
    const observerCreepName = `${this.targetRoomName}observer`
    if (Game.creeps[observerCreepName] != null) {
      return
    }

    const tasks: CreepTask[] = [
      MoveToRoomTask.create(this.targetRoomName, []),
      MoveToTask.create(new RoomPosition(25, 25, this.targetRoomName), 10),
    ]
    const initialTask = FleeFromSKLairTask.create(SequentialTask.create(tasks, { ignoreFailure: false, finishWhenSucceed: false }))

    World.resourcePools.addSpawnCreepRequest(parentRoom.name, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: observerCreepName,
      roles: [CreepRole.Scout],
      body: [MOVE],
      initialTask: initialTask,
      taskIdentifier: this.taskIdentifier,
      parentRoomName: null,
      name: observerCreepName,
    })
  }

  private nearestAvailableRooms(): Room[] {
    // TODO:
    const targetRoomInfo = RoomResources.getRoomInfo(this.targetRoomName)
    if (targetRoomInfo == null) {
      return []
    }
    return targetRoomInfo.neighbourRoomNames.flatMap(neighbourRoomName => {
      const resources = RoomResources.getOwnedRoomResource(neighbourRoomName)
      if (resources == null) {
        return []
      }
      return resources.room
    })
  }
}
