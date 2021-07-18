import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { World } from "world_info/world_info"
import { ProcessState } from "process/process_state"
import { generateCodename } from "utility/unique_id"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepRole } from "prototype/creep_role"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { TestRunHaulerTask } from "v5_object_task/creep_task/meta_task/test_run_hauler_task"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"

export interface Season687888RunHaulerTestProcessState extends ProcessState {
  /** parent room name */
  r: RoomName

  /** destination position */
  d: RoomPositionState
}

// Game.io("launch Season687888RunHaulerTestProcess room_name=W9S24 x=36 y=11")
export class Season687888RunHaulerTestProcess implements Process, Procedural {
  private readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    private readonly destinationPosition: RoomPosition,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}`
    this.codename = "swamp_runner" //generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season687888RunHaulerTestProcessState {
    return {
      t: "Season687888RunHaulerTestProcess",
      l: this.launchTime,
      i: this.processId,
      r: this.parentRoomName,
      d: this.destinationPosition.encode(),
    }
  }

  public static decode(state: Season687888RunHaulerTestProcessState): Season687888RunHaulerTestProcess | null {
    const destinationPosition = decodeRoomPosition(state.d)
    return new Season687888RunHaulerTestProcess(state.l, state.i, state.r, destinationPosition)
  }

  public static create(processId: ProcessId, roomName: RoomName, destinationPosition: RoomPosition): Season687888RunHaulerTestProcess {
    return new Season687888RunHaulerTestProcess(Game.time, processId, roomName, destinationPosition)
  }

  public processShortDescription(): string {
    return roomLink(this.parentRoomName)
  }

  public runOnTick(): void {
    const objects = World.rooms.getOwnedRoomObjects(this.parentRoomName)
    if (objects == null) {
      PrimitiveLogger.fatal(`${roomLink(this.parentRoomName)} lost`)
      return
    }

    const numberOfHaulers = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    if (numberOfHaulers <= 0) {
      this.addHauler()
    }

    const storage = objects.activeStructures.storage
    if (storage != null) {
      World.resourcePools.assignTasks(
        this.parentRoomName,
        this.identifier,
        CreepPoolAssignPriority.Low,
        () => TestRunHaulerTask.create(this.destinationPosition, storage),
        () => true,
      )
    }
  }

  private addHauler(): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Medium,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [CreepRole.Hauler, CreepRole.Mover],
      body: [CARRY, CARRY, CARRY, MOVE],
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }
}
