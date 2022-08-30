import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "shared/utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { SequentialTask, SequentialTaskOptions } from "v5_object_task/creep_task/combined_task/sequential_task"
import { TransferEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { SuicideApiWrapper } from "v5_object_task/creep_task/api_wrapper/suicide_api_wrapper"
import { EnergyChargeableStructure } from "prototype/room_object"
import { DropResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/drop_resource_api_wrapper"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { CreepBody } from "utility/creep_body"
import { ProcessDecoder } from "process/process_decoder"
import { MessageObserver } from "os/infrastructure/message_observer"
import { RoomResources } from "room_resource/room_resources"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { Position } from "prototype/room_position"
import { processLog } from "os/infrastructure/logger"
import { GameConstants } from "utility/constants"

ProcessDecoder.register("SendEnergyToAllyProcess", state => {
  return SendEnergyToAllyProcess.decode(state as SendEnergyToAllyProcessState)
})

const SpawnStopReasons = {
  noController: "no controller in the target room",
  terminalExists: "the target has a terminal",
  manually: "manually",
  droppedEnergyNotInUse: "dropped energy not in use",
}

const maxCarryAmount = 1000

export interface SendEnergyToAllyProcessState extends ProcessState {
  /** parent room name */
  readonly p: RoomName

  /** waypoints */
  readonly w: RoomName[]

  readonly targetRoomName: RoomName
  readonly finishWorking: number
  readonly maxNumberOfCreeps: number
  readonly stopSpawningReasons: string[]
  readonly allyRoomEntrancePosition: Position
}

/** Haulerによる輸送 */
export class SendEnergyToAllyProcess implements Process, Procedural, MessageObserver {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  private requestedObservation = false

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly parentRoomName: RoomName,
    private readonly targetRoomName: RoomName,
    private readonly waypoints: RoomName[],
    private readonly finishWorking: number,
    private readonly maxNumberOfCreeps: number,
    private stopSpawningReasons: string[],
    private allyRoomEntrancePosition: Position,
  ) {
    this.identifier = `${this.constructor.name}_${this.launchTime}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): SendEnergyToAllyProcessState {
    return {
      t: "SendEnergyToAllyProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      targetRoomName: this.targetRoomName,
      w: this.waypoints,
      finishWorking: this.finishWorking,
      maxNumberOfCreeps: this.maxNumberOfCreeps,
      stopSpawningReasons: this.stopSpawningReasons,
      allyRoomEntrancePosition: this.allyRoomEntrancePosition,
    }
  }

  public static decode(state: SendEnergyToAllyProcessState): SendEnergyToAllyProcess {
    return new SendEnergyToAllyProcess(state.l, state.i, state.p, state.targetRoomName, state.w, state.finishWorking, state.maxNumberOfCreeps, state.stopSpawningReasons, state.allyRoomEntrancePosition ?? {x: 27, y: 0})
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], finishWorking: number, maxNumberOfCreeps: number, allyRoomEntrancePosition: Position): SendEnergyToAllyProcess {
    return new SendEnergyToAllyProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, finishWorking, maxNumberOfCreeps, [], allyRoomEntrancePosition)
  }

  public processShortDescription(): string {
    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    const descriptions: string[] = [
      `${creepCount}cr`,
      `${roomLink(this.parentRoomName)} => ${roomLink(this.targetRoomName)}`,
    ]
    if (this.stopSpawningReasons.length > 0) {
      descriptions.push(`spawn stopped due to ${this.stopSpawningReasons.join(", ")}`)
    }
    return descriptions.join(", ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "stop", "resume"]
    const components = message.split(" ")
    const command = components.shift()

    switch (command) {
    case "help":
      return `Commands: ${commandList}`
    case "stop":
      this.addStopSpawningReasons(SpawnStopReasons.manually)
      return "spawn stopped"
    case "resume":
      this.stopSpawningReasons = []
      return "spawn resumed"
    default:
      return `Invalid command ${commandList}. see "help"`
    }
  }

  public runOnTick(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.parentRoomName)
    if (roomResource == null) {
      return
    }

    const targetRoom = Game.rooms[this.targetRoomName]
    if (targetRoom != null && this.stopSpawningReasons.length <= 0) {
      if (targetRoom.controller == null) {
        this.addStopSpawningReasons(SpawnStopReasons.noController)
      } else {
        if (targetRoom.controller.level >= 6 && targetRoom.find(FIND_HOSTILE_STRUCTURES, {filter: {structureType: STRUCTURE_TERMINAL}}).length > 0) {
          this.addStopSpawningReasons(SpawnStopReasons.terminalExists)
        }
      }
    }

    const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)

    const shouldSpawn = ((): boolean => {
      if (this.stopSpawningReasons.length > 0) {
        return false
      }
      if (roomResource.getResourceAmount(RESOURCE_ENERGY) < 70000) {
        return false
      }
      if (creeps.length >= this.maxNumberOfCreeps) {
        return false
      }
      return true
    })()
    if (shouldSpawn === true) {
      this.requestCreep(roomResource)
    }

    const energyStore = ((): StructureTerminal | StructureStorage | null => {
      if (roomResource.activeStructures.storage != null && roomResource.activeStructures.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 3000) {
        return roomResource.activeStructures.storage
      }
      if (roomResource.activeStructures.terminal != null && roomResource.activeStructures.terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 3000) {
        return roomResource.activeStructures.terminal
      }
      return null
    })()

    if (energyStore != null) {
      this.runCreep(energyStore)
    }
  }

  private requestCreep(roomResource: OwnedRoomResource): void {
    const maxUnits = Math.floor(maxCarryAmount / GameConstants.creep.actionPower.carryCapacity)
    const body = CreepBody.create([], [CARRY, MOVE], roomResource.controller.room.energyCapacityAvailable, maxUnits)

    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [CreepRole.Hauler, CreepRole.Mover],
      body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runCreep(energyStore: StructureTerminal | StructureStorage): void {
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      (creep => {
        const task = this.creepTask(creep, energyStore)
        if (task == null) {
          return null
        }
        return FleeFromAttackerTask.create(task)
      }),
      () => true,
    )
  }

  private creepTask(creep: Creep, energyStore: StructureTerminal | StructureStorage): CreepTask | null {
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
      if (creep.ticksToLive != null && creep.ticksToLive < this.finishWorking) {
        return RunApiTask.create(SuicideApiWrapper.create())
      }
      if (creep.room.name === this.targetRoomName && creep.pos.isRoomEdge !== true && this.allyRoomEntrancePosition != null) {
        const position = new RoomPosition(this.allyRoomEntrancePosition.x, this.allyRoomEntrancePosition.y, creep.room.name)
        return MoveToTask.create(position, 0, { isAllyRoom: true })
      }
      if (creep.room.name === this.parentRoomName) {
        return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(energyStore, RESOURCE_ENERGY))
      }
      const waypoints = ((): RoomName[] => {
        if (creep.room.name === this.targetRoomName) {
          const reversedWaypoints = [...this.waypoints]
          reversedWaypoints.reverse()
          return reversedWaypoints
        }
        return []
      })()
      return MoveToRoomTask.create(this.parentRoomName, waypoints)
    }

    if (creep.room.name !== this.targetRoomName) {
      const waypoints = ((): RoomName[] => {
        if (creep.room.name === this.parentRoomName) {
          return this.waypoints
        }
        return []
      })()

      return MoveToRoomTask.create(this.targetRoomName, waypoints)
    }

    if (this.allyRoomEntrancePosition == null && creep.pos.isRoomEdge === true) { // MoveToRoomTaskはroom edgeから1sq入ったところで終了するため動いていない
      this.allyRoomEntrancePosition = {
        x: creep.pos.x,
        y: creep.pos.y,
      }
    }

    const chargeableStructure = ((): EnergyChargeableStructure | StructureStorage | null => {
      const isTransferrable = (structure: AnyOwnedStructure): boolean => {
        const rampart = structure.pos.findInRange(FIND_HOSTILE_STRUCTURES, 0, { filter: { structureType: STRUCTURE_RAMPART } })[0] as StructureRampart | null
        if (rampart == null) {
          return true
        }
        if (rampart.isPublic === true) {
          return true
        }
        return false
      }

      const allyStructures = creep.room.find(FIND_HOSTILE_STRUCTURES)
      for (const structure of allyStructures) {
        if (structure.structureType === STRUCTURE_STORAGE && isTransferrable(structure) === true) {
          return structure
        }
        if (structure.structureType === STRUCTURE_TERMINAL && isTransferrable(structure) === true) {
          return structure
        }
      }
      return null
    })()

    if (chargeableStructure == null || chargeableStructure.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) {
      const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES).find(resource => {
        if (resource.resourceType !== RESOURCE_ENERGY) {
          return false
        }
        if (resource.pos.findInRange(FIND_HOSTILE_CREEPS, 0).length > 0) {
          return false
        }
        if (resource.pos.findInRange(FIND_HOSTILE_CONSTRUCTION_SITES, 0).length > 0) {
          return false
        }
        if (resource.amount > (maxCarryAmount * this.maxNumberOfCreeps)) {
          this.addStopSpawningReasons(SpawnStopReasons.droppedEnergyNotInUse)
        }
        return true
      })
      if (droppedEnergy != null) {
        if (droppedEnergy.pos.isEqualTo(creep.pos) === true) {
          return RunApiTask.create(DropResourceApiWrapper.create(RESOURCE_ENERGY))
        } else {
          const tasks: CreepTask[] = [
            MoveToTask.create(droppedEnergy.pos, 0, { isAllyRoom: true }),
            RunApiTask.create(DropResourceApiWrapper.create(RESOURCE_ENERGY)),
          ]
          return SequentialTask.create(tasks, {ignoreFailure: false, finishWhenSucceed: false})
        }
      }

      const targetObject = creep.room.find(FIND_HOSTILE_STRUCTURES, {filter: {structureType: STRUCTURE_SPAWN}})[0] ?? creep.room.controller
      if (targetObject == null) {
        this.addStopSpawningReasons(SpawnStopReasons.noController)
        return null
      }

      if (targetObject.pos.isNearTo(creep.pos) === true) {
        return RunApiTask.create(DropResourceApiWrapper.create(RESOURCE_ENERGY))
      } else {
        const tasks: CreepTask[] = [
          MoveToTask.create(targetObject.pos, 1, {isAllyRoom: true}),
          RunApiTask.create(DropResourceApiWrapper.create(RESOURCE_ENERGY)),
        ]
        return SequentialTask.create(tasks, { ignoreFailure: false, finishWhenSucceed: false })
      }
    }

    const options: SequentialTaskOptions = {
      ignoreFailure: false,
      finishWhenSucceed: false,
    }
    const tasks: CreepTask[] = [
      MoveToRoomTask.create(this.targetRoomName, this.waypoints),
      MoveToTargetTask.create(TransferEnergyApiWrapper.create(chargeableStructure), { isAllyRoom: true }),
    ]
    return FleeFromAttackerTask.create(SequentialTask.create(tasks, options))
  }

  private addStopSpawningReasons(reason: string): void {
    if (this.stopSpawningReasons.includes(reason) === true) {
      return
    }
    this.stopSpawningReasons.push(reason)
    processLog(this, `stop due to: ${reason}`)
  }
}
