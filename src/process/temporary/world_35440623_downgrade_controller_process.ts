import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
import { coloredText, roomLink } from "utility/log"
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
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { SuicideApiWrapper } from "v5_object_task/creep_task/api_wrapper/suicide_api_wrapper"
import { processLog } from "os/infrastructure/logger"
import { OwnedRoomProcess } from "process/owned_room_process"
import { AggressiveClaimProcess } from "process/onetime/attack/aggressive_claim_process"
import { EndlessTask } from "v5_object_task/creep_task/meta_task/endless_task"

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
  suicideWhenFinished: boolean
}

export class World35440623DowngradeControllerProcess implements Process, Procedural, OwnedRoomProcess, MessageObserver {
  public get taskIdentifier(): string {
    return this.identifier
  }
  public get ownedRoomName(): RoomName {
    return this.parentRoomName
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
    private suicideWhenFinished: boolean,
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
      suicideWhenFinished: this.suicideWhenFinished,
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
      state.suicideWhenFinished ?? true,
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
      true,
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
    const commandList = ["help", "stop", "resume", "reset_timer", "change_interval", "suicide_when_finished"]
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

    case "suicide_when_finished": {
      const listArguments = new ListArguments(components)
      const previousValue = this.suicideWhenFinished
      this.suicideWhenFinished = listArguments.boolean(0, "suicide enabled").parse()

      return `set suicide_when_finished ${previousValue} => ${this.suicideWhenFinished}`
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

  // private destroyStructures(targetRoom: Room): boolean {
  //   if (targetRoom.find(FIND_HOSTILE_CREEPS).length > 0) {
  //     return false
  //   }

  //   try {
  //     const destroyStructure = (structure: AnyStructure): void => {
  //       const result = structure.destroy()
  //       switch (result) {
  //       case OK:
  //         return
  //       case ERR_NOT_OWNER:
  //         throw `destroyStructure() ${roomLink(targetRoom.name)} is not mine`
  //       case ERR_BUSY:
  //         throw `destroyStructure() enemy in ${roomLink(targetRoom.name)}`
  //       }
  //     }

  //     const walls = targetRoom.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_WALL } })
  //     walls.forEach(wall => destroyStructure(wall))

  //     const hostileStructures = targetRoom.find(FIND_HOSTILE_STRUCTURES)
  //     const excludeStructureTypes: StructureConstant[] = [
  //       STRUCTURE_STORAGE,
  //       STRUCTURE_TERMINAL,
  //       STRUCTURE_NUKER,
  //     ]
  //     hostileStructures.forEach(structure => {
  //       if (excludeStructureTypes.includes(structure.structureType) === true) {
  //         return
  //       }
  //       destroyStructure(structure)
  //     })

  //   } catch (error) {
  //     PrimitiveLogger.fatal(`${this.taskIdentifier} ${error}`)
  //     return false
  //   }

  //   return true
  // }

  private spawnDowngrader(resources: OwnedRoomResource): void {
    const maxClaimSize = Math.min(this.maxClaimSize, 20)
    const body = ((): BodyPartConstant[] => {
      const energyAmount = (resources.activeStructures.terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0) + (resources.activeStructures.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
      const minimumEnergy = ((): number => {
        if (resources.controller.level >= 8) {
          return 70000
        }
        return 40000
      })()

      if (energyAmount < minimumEnergy) {
        return [CLAIM, MOVE]
      }

      const energyCapacityAvailable = resources.room.energyCapacityAvailable
      const fastMoveBody = CreepBody.create([], [MOVE, CLAIM, MOVE], energyCapacityAvailable, maxClaimSize)
      const normalBody = CreepBody.create([], [CLAIM, MOVE], energyCapacityAvailable, maxClaimSize)
      if (fastMoveBody.length < (normalBody.length * 1.5)) {
        return normalBody
      }
      return fastMoveBody
    })()

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

  private newTaskFor(creep: Creep): CreepTask | null {
    if (creep.ticksToLive == null) {
      this.lastSpawnTime = Game.time
    }

    const controller = creep.room.controller
    const attackTarget = ((): StructureController | null => {
      if (controller == null) {
        return null
      }
      if (this.targetRoomNames.includes(controller.room.name) !== true) {
        return null
      }
      if (controller.owner == null) {
        return null
      }
      if (controller.my === true) {
        return null
      }
      if (controller.reservation?.username === Game.user.name) {
        return null
      }
      if ((controller.upgradeBlocked ?? 0) > (creep.ticksToLive ?? 0)) {
        return null
      }
      return controller
    })()

    if (attackTarget != null) {
      return FleeFromAttackerTask.create(MoveToTargetTask.create(AttackControllerApiWrapper.create(attackTarget), { ignoreSwamp: false, reusePath: 0 }))
    }

    ((): void => {
      if (controller == null) {
        return
      }
      const index = this.targetRoomNames.indexOf(controller.room.name)
      if (index < 0) {
        return
      }
      if (controller.my === true) {
        this.targetRoomNames.splice(index, 1)
        return
      }
      if (controller.owner != null) {
        return
      }
      this.targetRoomNames.splice(index, 1)
      this.launchAggressiveClaimProcess(controller)
    })()

    const moveToNextRoomTask = this.moveToNextRoomTask(creep)
    if (moveToNextRoomTask == null) {
      creep.say("finished")

      const canQuit = ((): boolean => {
        if (this.targetRoomNames.length > 1) {
          return false
        }
        if (controller == null) {
          return false
        }
        if (this.targetRoomNames.includes(controller.room.name) !== true) {
          return false
        }
        if (controller.level <= 0) {
          return true
        }
        if (controller.level === 1 && controller.ticksToDowngrade < 2000) {
          return true
        }
        return false
      })()

      if (canQuit === true) {
        this.addSpawnStopReason("unclaimed")
        processLog(this, `${coloredText("[Downgrade]", "info")} ${roomLink(creep.room.name)} is about to unclaim`)
      }

      if (this.suicideWhenFinished === true) {
        return RunApiTask.create(SuicideApiWrapper.create())
      } else {
        return EndlessTask.create()
      }
    }
    return moveToNextRoomTask
  }

  private launchAggressiveClaimProcess(controller: StructureController): void {
    processLog(this, `${roomLink(controller.room.name)} unclaimed`)

    const excludedStructureIds: Id<(StructureStorage | StructureTerminal)>[] = []
    const hostileStructures = controller.room.find(FIND_HOSTILE_STRUCTURES)

    hostileStructures.forEach(structure => {
      if (structure.structureType === STRUCTURE_TERMINAL) {
        excludedStructureIds.push(structure.id)
        return
      }
      if (structure.structureType === STRUCTURE_STORAGE) {
        excludedStructureIds.push(structure.id)
        return
      }
    })

    if (hostileStructures.length === excludedStructureIds.length) {
      processLog(this, `no structures to destroy in ${roomLink(controller.room.name)}`)
      return
    }

    OperatingSystem.os.addProcess(null, processId => AggressiveClaimProcess.create(
      processId,
      this.parentRoomName,
      controller.room.name,
      [],
      excludedStructureIds,
    ))
    processLog(this, `launched AggressiveClaimProcess to destroy ${hostileStructures.length - excludedStructureIds.length} structures in ${roomLink(controller.room.name)}`)
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
