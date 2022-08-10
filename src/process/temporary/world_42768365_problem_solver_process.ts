import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredText, roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { RoomName } from "utility/room_name"
import { ProcessDecoder } from "process/process_decoder"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { RoomResources } from "room_resource/room_resources"
import { World } from "world_info/world_info"
import { UniqueId } from "utility/unique_id"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepBody } from "utility/creep_body"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { BuildApiWrapper } from "v5_object_task/creep_task/api_wrapper/build_api_wrapper"
import { HarvestEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/harvest_energy_api_wrapper"

ProcessDecoder.register("World42768365ProblemSolverProcess", state => {
  return World42768365ProblemSolverProcess.decode(state as World42768365ProblemSolverProcessState)
})

export interface World42768365ProblemSolverProcessState extends ProcessState {
  readonly roomName: RoomName
}

export class World42768365ProblemSolverProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly roomName: RoomName,
  ) {
    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
    this.codename = UniqueId.generateCodename(this.taskIdentifier, this.launchTime)
  }

  public encode(): World42768365ProblemSolverProcessState {
    return {
      t: "World42768365ProblemSolverProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
    }
  }

  public static decode(state: World42768365ProblemSolverProcessState): World42768365ProblemSolverProcess {
    return new World42768365ProblemSolverProcess(state.l, state.i, state.roomName)
  }

  public static create(processId: ProcessId, roomName: RoomName): World42768365ProblemSolverProcess {
    if (Memory.ignoreRooms.includes(roomName) !== true) {
      Memory.ignoreRooms.push(roomName)
      PrimitiveLogger.log(`${coloredText(`Added ${roomLink(roomName)} to ignore rooms`, "warn")}`)
    }
    return new World42768365ProblemSolverProcess(Game.time, processId, roomName)
  }

  public deinit(): void {
    const index = Memory.ignoreRooms.indexOf(this.roomName)
    if (index >= 0) {
      Memory.ignoreRooms.splice(index, 1)
    }
  }

  public processShortDescription(): string {
    return `${roomLink(this.roomName)}`
  }

  public runOnTick(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return
    }

    if (roomResource.activeStructures.spawns.length <= 0) {
      this.buildSpawn(roomResource, "W45S9") // FixMe: 終わったら消す
      return
    }
  }

  private buildSpawn(roomResource: OwnedRoomResource, parentRoomName: RoomName): void {
    const creepCount = World.resourcePools.countCreeps(parentRoomName, this.taskIdentifier, () => true)
    if (creepCount < 2) {
      World.resourcePools.addSpawnCreepRequest(parentRoomName, {
        priority: CreepSpawnRequestPriority.Low,
        numberOfCreeps: 1,
        codename: this.codename,
        roles: [],
        body: CreepBody.create([], [MOVE, MOVE, MOVE, CARRY, WORK, WORK], 10000, 4),
        initialTask: null,
        taskIdentifier: this.taskIdentifier,
        parentRoomName: null,
      })
    }

    World.resourcePools.assignTasks(
      parentRoomName,
      this.taskIdentifier,
      CreepPoolAssignPriority.Low,
      creep => {
        const task = this.builderTask(creep, roomResource)
        if (task == null) {
          return null
        }
        return FleeFromAttackerTask.create(task)
      },
      () => true,
    )
  }

  private builderTask(creep: Creep, roomResource: OwnedRoomResource): CreepTask | null {
    if (creep.store.getFreeCapacity() <= 0) {
      const constructionSite = creep.room.find(FIND_MY_CONSTRUCTION_SITES)[0]
      if (constructionSite == null) {
        creep.say("no task")
        return null
      }

      return MoveToTargetTask.create(BuildApiWrapper.create(constructionSite))
    }

    const source = roomResource.sources[0]
    if (source == null) {
      creep.say("no src")
      return null
    }
    return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(source))
  }
}
