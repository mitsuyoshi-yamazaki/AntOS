import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { Timestamp } from "utility/timestamp"
import { RoomResources } from "room_resource/room_resources"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { CreepBody } from "utility/creep_body"
import { AttackControllerApiWrapper } from "v5_object_task/creep_task/api_wrapper/attack_controller_api_wrapper"

const attackControllerCooldownTime = 1000
const attackControllerInterval = attackControllerCooldownTime + 100

export interface World35440623DowngradeControllerProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  targetRoomNames: RoomName[]
  currentTargetRoomNames: RoomName[]
  lastSpawnTime: Timestamp
}

// Game.io("launch -l World35440623DowngradeControllerProcess room_name=W48S26 target_room_names=W48S25,W46S23,W45S23,W44S23,W44S22")
export class World35440623DowngradeControllerProcess implements Process, Procedural {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    private readonly targetRoomNames: RoomName[],
    private currentTargetRoomNames: RoomName[],
    private lastSpawnTime: Timestamp,
  ) {
    this.identifier = `${this.constructor.name}_${this.launchTime}_${this.parentRoomName}_${this.targetRoomNames}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): World35440623DowngradeControllerProcessState {
    return {
      t: "World35440623DowngradeControllerProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      targetRoomNames: this.targetRoomNames,
      currentTargetRoomNames: this.currentTargetRoomNames,
      lastSpawnTime: this.lastSpawnTime,
    }
  }

  public static decode(state: World35440623DowngradeControllerProcessState): World35440623DowngradeControllerProcess {
    return new World35440623DowngradeControllerProcess(state.l, state.i, state.p, state.targetRoomNames, state.currentTargetRoomNames, state.lastSpawnTime)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomNames: RoomName[]): World35440623DowngradeControllerProcess {
    return new World35440623DowngradeControllerProcess(Game.time, processId, parentRoomName, targetRoomNames, [...targetRoomNames], 0)
  }

  public processShortDescription(): string {
    const ticksToSpawn = Math.max(attackControllerInterval - (Game.time - this.lastSpawnTime), 0)
    return `${ticksToSpawn} to go, ${this.targetRoomNames.map(roomName => roomLink(roomName)).join(",")}`
  }

  public runOnTick(): void {
    const resources = RoomResources.getOwnedRoomResource(this.parentRoomName)
    if (resources == null) {
      PrimitiveLogger.fatal(`${roomLink(this.parentRoomName)} lost`)
      return
    }

    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    if (creepCount < 1 && (Game.time - attackControllerInterval) > this.lastSpawnTime) {
      const energyAmount = (resources.activeStructures.terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0) + (resources.activeStructures.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
      const body = CreepBody.create([], [CLAIM, MOVE], resources.room.energyCapacityAvailable, 20)
      const minimumEnergy = ((): number => {
        if (resources.controller.level >= 8) {
          return 70000
        }
        return 40000
      })()
      if (energyAmount > minimumEnergy) {
        this.currentTargetRoomNames = [...this.targetRoomNames]
        this.spawnDowngrader(body)
      }
    }

    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.newTaskFor(creep),
      () => true,
    )
  }

  private spawnDowngrader(body: BodyPartConstant[]): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [CreepRole.Claimer, CreepRole.Mover],
      body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private newTaskFor(creep: Creep): CreepTask | null {
    if (creep.ticksToLive == null) {
      this.lastSpawnTime = Game.time
    }

    const controller = creep.room.controller
    if (controller == null || controller.owner == null || controller.my === true || (controller.upgradeBlocked ?? 0) > 0) {
      const moveToNextRoomTask = this.moveToNextRoomTask()
      if (moveToNextRoomTask == null) {
        creep.say("finished")
      }
      return moveToNextRoomTask
    }
    return MoveToTargetTask.create(AttackControllerApiWrapper.create(controller), {ignoreSwamp: false, reusePath: 0})
  }

  private moveToNextRoomTask(): CreepTask | null {
    const nextRoomName = this.nextRoomName()
    if (nextRoomName == null) {
      return null
    }
    return MoveToRoomTask.create(nextRoomName, [])
  }

  private nextRoomName(): RoomName | null {
    return this.currentTargetRoomNames.shift() ?? null
  }
}
