import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
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
import { Timestamp } from "shared/utility/timestamp"
import { RoomResources } from "room_resource/room_resources"
import { CreepBody } from "utility/creep_body"
import { AttackControllerApiWrapper } from "v5_object_task/creep_task/api_wrapper/attack_controller_api_wrapper"
import { ProcessDecoder } from "process/process_decoder"
import { MessageObserver } from "os/infrastructure/message_observer"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { OperatingSystem } from "os/os"
import { GameMap } from "game/game_map"
import { ListArguments } from "shared/utility/argument_parser/list_argument_parser"

ProcessDecoder.register("World35440623DowngradeControllerProcess", state => {
  return World35440623DowngradeControllerProcess.decode(state as World35440623DowngradeControllerProcessState)
})

const attackControllerCooldownTime = 1000
const defaultAttackControllerInterval = attackControllerCooldownTime + 100

export interface World35440623DowngradeControllerProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  targetRoomNames: RoomName[]
  currentTargetRoomNames: RoomName[]
  lastSpawnTime: Timestamp
  maxClaimSize: number
  spawnStopReasons: string[]
  attackControllerInterval: number
}

export class World35440623DowngradeControllerProcess implements Process, Procedural, MessageObserver {
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
    private readonly maxClaimSize: number,
    private spawnStopReasons: string[],
    private attackControllerInterval: number,
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
      maxClaimSize: this.maxClaimSize,
      spawnStopReasons: this.spawnStopReasons,
      attackControllerInterval: this.attackControllerInterval,
    }
  }

  public static decode(state: World35440623DowngradeControllerProcessState): World35440623DowngradeControllerProcess {
    return new World35440623DowngradeControllerProcess(
      state.l,
      state.i,
      state.p,
      state.targetRoomNames,
      state.currentTargetRoomNames,
      state.lastSpawnTime,
      state.maxClaimSize,
      state.spawnStopReasons,
      state.attackControllerInterval,
    )
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomNames: RoomName[], maxClaimSize: number): World35440623DowngradeControllerProcess {
    return new World35440623DowngradeControllerProcess(Game.time,
      processId,
      parentRoomName,
      targetRoomNames,
      [...targetRoomNames],
      0,
      maxClaimSize,
      [],
      defaultAttackControllerInterval,
    )
  }

  public processShortDescription(): string {
    const ticksToSpawn = Math.max(this.attackControllerInterval - (Game.time - this.lastSpawnTime), 0)
    const descriptions: string[] = [
      `${ticksToSpawn} to go (interval: ${this.attackControllerInterval})`,
      this.targetRoomNames.map(roomName => roomLink(roomName)).join(","),
    ]

    const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.taskIdentifier)
    if (creeps.length > 0) {
      descriptions.push(`creep in ${creeps.map(creep => roomLink(creep.room.name)).join(",")}`)
    } else {
      descriptions.push("no creeps")
    }

    if (this.spawnStopReasons.length > 0) {
      descriptions.push(`stopped by: ${this.spawnStopReasons.join(",")}`)
    }

    return descriptions.join(", ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "stop", "resume", "reset_timer", "change_interval"]
    const components = message.split(" ")
    const command = components.shift()

    switch (command) {
    case "help":
      return `Commands: ${commandList}`

    case "stop":
      this.addSpawnStopReason("manually stop")
      return "stopped"

    case "resume": {
      const reasons = [...this.spawnStopReasons]
      this.spawnStopReasons = []
      return `resumed (stop reasons were: ${reasons.join(", ")})`
    }

    case "reset_timer": {
      const oldValue = this.lastSpawnTime
      this.lastSpawnTime = 0
      return `timer (${Math.max(this.attackControllerInterval - (Game.time - oldValue), 0)} to go) reset`
    }

    case "change_interval": {
      const listArguments = new ListArguments(components)
      const oldValue = this.attackControllerInterval
      const interval = listArguments.int(0, "interval").parse({min: 100})
      this.attackControllerInterval = interval
      return `changed interval ${oldValue} =&gt ${this.attackControllerInterval}`
    }

    default:
      return `Invalid command ${command}. "help" to show command list`
    }
  }

  public runOnTick(): void {
    const resources = RoomResources.getOwnedRoomResource(this.parentRoomName)
    if (resources == null) {
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }

    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier)
    if (creepCount < 1 && (Game.time - this.attackControllerInterval) > this.lastSpawnTime) {
      if (this.spawnStopReasons.length <= 0) {
        this.spawnDowngrader(resources)
      }
    }

    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.newTaskFor(creep),
    )
  }

  private spawnDowngrader(resources: OwnedRoomResource): void {
    const energyAmount = (resources.activeStructures.terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0) + (resources.activeStructures.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
    const maxClaimSize = Math.min(this.maxClaimSize, 20)
    const body = ((): BodyPartConstant[] => {
      const energyCapacityAvailable = resources.room.energyCapacityAvailable
      const fastMoveBody = CreepBody.create([], [MOVE, CLAIM, MOVE], energyCapacityAvailable, maxClaimSize)
      const normalBody = CreepBody.create([], [CLAIM, MOVE], energyCapacityAvailable, maxClaimSize)
      if (fastMoveBody.length < (normalBody.length * 1.5)) {
        return normalBody
      }
      return fastMoveBody
    })()
    const minimumEnergy = ((): number => {
      if (resources.controller.level >= 8) {
        return 70000
      }
      return 40000
    })()
    if (energyAmount > minimumEnergy) {
      this.currentTargetRoomNames = [...this.targetRoomNames]

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
  }

  private newTaskFor(creep: Creep): CreepTask | null {
    if (creep.ticksToLive == null) {
      this.lastSpawnTime = Game.time
    }

    const controller = creep.room.controller
    if (controller == null || controller.owner == null || controller.my === true || (controller.upgradeBlocked ?? 0) > creep.pos.getRangeTo(controller.pos)) {
      const moveToNextRoomTask = this.moveToNextRoomTask(creep)
      if (moveToNextRoomTask == null) {
        creep.say("finished")
      }
      return moveToNextRoomTask
    }
    return FleeFromAttackerTask.create(MoveToTargetTask.create(AttackControllerApiWrapper.create(controller), { ignoreSwamp: false, reusePath: 0 }))
  }

  private moveToNextRoomTask(creep: Creep): CreepTask | null {
    const nextRoomName = this.nextRoomName()
    if (nextRoomName == null) {
      return null
    }
    const waypoints = GameMap.getWaypoints(creep.room.name, nextRoomName, {ignoreMissingWaypoints: true}) ?? []
    return FleeFromAttackerTask.create(MoveToRoomTask.create(nextRoomName, waypoints))
  }

  private nextRoomName(): RoomName | null {
    return this.currentTargetRoomNames.shift() ?? null
  }

  private addSpawnStopReason(reason: string): void {
    if (this.spawnStopReasons.includes(reason) === true) {
      return
    }
    this.spawnStopReasons.push(reason)
  }
}
