import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredText, roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import type { RoomName } from "shared/utility/room_name_types"
import { ProcessDecoder } from "process/process_decoder"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { RoomResources } from "room_resource/room_resources"
import { World } from "world_info/world_info"
import { UniqueId } from "utility/unique_id"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepBody } from "utility/creep_body"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { HarvestEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/harvest_energy_api_wrapper"
import { UpgradeControllerApiWrapper } from "v5_object_task/creep_task/api_wrapper/upgrade_controller_api_wrapper"

ProcessDecoder.register("World42768365ProblemSolverProcess", state => {
  return World42768365ProblemSolverProcess.decode(state as World42768365ProblemSolverProcessState)
})

type Problem = string

export interface World42768365ProblemSolverProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly problems: Problem[]
}

export class World42768365ProblemSolverProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly problems: Problem[]
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
      problems: this.problems,
    }
  }

  public static decode(state: World42768365ProblemSolverProcessState): World42768365ProblemSolverProcess {
    return new World42768365ProblemSolverProcess(state.l, state.i, state.roomName, state.problems ?? [])
  }

  public static create(processId: ProcessId, roomName: RoomName): World42768365ProblemSolverProcess {
    if (Memory.ignoreRooms.includes(roomName) !== true) {
      Memory.ignoreRooms.push(roomName)
      PrimitiveLogger.log(`${coloredText(`Added ${roomLink(roomName)} to ignore rooms`, "warn")}`)
    }
    return new World42768365ProblemSolverProcess(Game.time, processId, roomName, [])
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

  public processDescription(): string {
    const descriptions: string[] = [
      roomLink(this.roomName),
      "problems:",
      ...this.problems,
    ]
    return descriptions.join("\n")
  }

  public runOnTick(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return
    }

    const problemMaxCount = 50
    const deleteCount = this.problems.length - problemMaxCount
    if (deleteCount > 0) {
      this.problems.splice(50, deleteCount)
    }

    this.keepUpgrading(roomResource)
    this.watchDog(roomResource)
  }

  private keepUpgrading(roomResource: OwnedRoomResource): void {
    const creepCount = World.resourcePools.countCreeps(this.roomName, this.taskIdentifier, () => true)
    if (creepCount < 4) {
      World.resourcePools.addSpawnCreepRequest(this.roomName, {
        priority: CreepSpawnRequestPriority.Low,
        numberOfCreeps: 1,
        codename: this.codename,
        roles: [],
        body: CreepBody.create([], [MOVE, CARRY, WORK], roomResource.room.energyCapacityAvailable, 4),
        initialTask: null,
        taskIdentifier: this.taskIdentifier,
        parentRoomName: null,
      })
    }

    World.resourcePools.assignTasks(
      this.roomName,
      this.taskIdentifier,
      CreepPoolAssignPriority.Low,
      creep => this.upgradeTask(creep, roomResource),
      () => true,
    )
  }

  private upgradeTask(creep: Creep, roomResource: OwnedRoomResource): CreepTask | null {
    if (creep.store.getFreeCapacity() <= 0) {
      return MoveToTargetTask.create(UpgradeControllerApiWrapper.create(roomResource.controller))
    }

    const source = roomResource.sources[0]
    if (source == null) {
      creep.say("no src")
      return null
    }
    return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(source))
  }

  private watchDog(roomResource: OwnedRoomResource): void {
    roomResource.sources.forEach(source => {
      if (source.ticksToRegeneration == null || source.ticksToRegeneration > 1) {
        return
      }
      this.assert(source.energy > 50, `source ${source.id} energy ${source.energy}`)
    })
  }

  private assert(condition: boolean, problem: Problem): void {
    if (condition === true) {
      return
    }

    this.problems.unshift(problem)
  }
}
