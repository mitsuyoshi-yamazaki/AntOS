import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"
import { World } from "world_info/world_info"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { generateCodename } from "utility/unique_id"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import type { Timestamp } from "shared/utility/timestamp"
import { RoomResources } from "room_resource/room_resources"
import { CreepBody } from "utility/creep_body"
import { OwnedRoomProcess } from "process/owned_room_process"
import { GameMap } from "game/game_map"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { UpgradeControllerApiWrapper } from "v5_object_task/creep_task/api_wrapper/upgrade_controller_api_wrapper"
import { HarvestEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/harvest_energy_api_wrapper"
import { roomLink } from "utility/log"

const spawnInterval = 2000

ProcessDecoder.register("MaintainLostRoomProcess", state => {
  return MaintainLostRoomProcess.decode(state as MaintainLostRoomProcessState)
})

interface MaintainLostRoomProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetRoomName: RoomName
  readonly lastSpawnTime: Timestamp
}

export class MaintainLostRoomProcess implements Process, Procedural, OwnedRoomProcess {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }
  public get ownedRoomName(): RoomName {
    return this.roomName
  }

  private readonly codename: string
  private cachedBody: BodyPartConstant[] | null = null
  private get nextSpawnTime(): Timestamp {
    return this.lastSpawnTime + spawnInterval
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly targetRoomName: RoomName,
    private lastSpawnTime: Timestamp,
  ) {
    this.identifier = `${this.constructor.name}_${this.processId}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): MaintainLostRoomProcessState {
    return {
      t: "MaintainLostRoomProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetRoomName: this.targetRoomName,
      lastSpawnTime: this.lastSpawnTime,
    }
  }

  public static decode(state: MaintainLostRoomProcessState): MaintainLostRoomProcess {
    return new MaintainLostRoomProcess(state.l, state.i, state.roomName, state.targetRoomName, state.lastSpawnTime)
  }

  public static create(processId: ProcessId, roomName: RoomName, targetRoomName: RoomName): MaintainLostRoomProcess {
    return new MaintainLostRoomProcess(Game.time, processId, roomName, targetRoomName, 0)
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      `${roomLink(this.roomName)} =&gt ${roomLink(this.targetRoomName)}`,
      `next spawn: in ${this.lastSpawnTime + spawnInterval - Game.time} ticks`,
    ]
    const upgraders = World.resourcePools.getCreeps(this.roomName, this.identifier, () => true)
    if (upgraders[0] != null) {
      descriptions.push(`${upgraders[0].name} in ${roomLink(upgraders[0].room.name)}`)
    }

    return descriptions.join(", ")
  }

  public runOnTick(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return
    }

    const upgraders = World.resourcePools.getCreeps(this.roomName, this.identifier, () => true)

    const shouldSpawn = ((): boolean => {
      if (upgraders.length > 0) {
        return false
      }
      if (Game.time < this.nextSpawnTime) {
        return false
      }
      return true
    })()

    if (shouldSpawn === true) {
      const body = ((): BodyPartConstant[] => {
        if (this.cachedBody != null) {
          return this.cachedBody
        }
        const calculated = CreepBody.create([], [WORK, WORK, CARRY, MOVE, MOVE, MOVE], roomResource.room.energyCapacityAvailable, 8)
        const priority = {
          "work": 0,
          "carry": 1,
          "move": 2,
        }
        calculated.sort((lhs, rhs) => priority[lhs] - priority[rhs])
        this.cachedBody = calculated
        return calculated
      })()

      World.resourcePools.addSpawnCreepRequest(this.roomName, {
        priority: CreepSpawnRequestPriority.Low,
        numberOfCreeps: 1,
        codename: this.codename,
        roles: [],
        body,
        initialTask: null,
        taskIdentifier: this.identifier,
        parentRoomName: null,
      })
    }

    World.resourcePools.assignTasks(
      this.roomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.creepTask(creep),
      () => true,
    )
  }

  private creepTask(creep: Creep): CreepTask | null {
    if (creep.ticksToLive == null) {
      this.lastSpawnTime = Game.time
    }

    if (creep.room.name !== this.targetRoomName) {
      const waypoints = GameMap.getWaypoints(creep.room.name, this.targetRoomName) ?? []
      return FleeFromAttackerTask.create(MoveToRoomTask.create(this.targetRoomName, waypoints))
    }

    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) {
      const controller = creep.room.controller
      if (controller == null) {
        creep.say("no ctrl")
        return null
      }
      return FleeFromAttackerTask.create(MoveToTargetTask.create(UpgradeControllerApiWrapper.create(controller)))
    }

    const source = creep.pos.findClosestByRange(creep.room.find(FIND_SOURCES_ACTIVE))
    if (source == null) {
      creep.say("no src")
      return null
    }

    return FleeFromAttackerTask.create(MoveToTargetTask.create(HarvestEnergyApiWrapper.create(source, false)))
  }
}
