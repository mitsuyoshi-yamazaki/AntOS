import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { ProcessState } from "../../process_state"
import { ProcessDecoder } from "../../process_decoder"
import { UniqueId } from "utility/unique_id"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { MessageObserver } from "os/infrastructure/message_observer"
import { Environment } from "utility/environment"
import { RoomResources } from "room_resource/room_resources"
import { CreepBody } from "utility/creep_body"
import { GameConstants } from "utility/constants"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { GameMap } from "game/game_map"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { SuicideApiWrapper } from "v5_object_task/creep_task/api_wrapper/suicide_api_wrapper"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"
import { ListArguments } from "shared/utility/argument_parser/list_argument_parser"
import { CreepName } from "prototype/creep"
// import { InterShardMemoryWatcher } from "utility/inter_shard_memory"

ProcessDecoder.register("IntershardResourceTransferProcess", state => {
  return IntershardResourceTransferProcess.decode(state as IntershardResourceTransferProcessState)
})

const testing = true as boolean // FixMe:

const StopSpawningReasons = {
  manually: "manually",
  attacked: "attacked",
  noPortal: "no_portal",
}

interface IntershardResourceTransferProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly portalRoomName: RoomName
  readonly targetShardName: string
  readonly resourceAmounts: { [resourceType: string]: number }
  readonly finishWorking: number
  readonly creepCount: number
  readonly spawnedCreepNames: CreepName[]
  readonly stopSpawningReasons: string[]
}

export class IntershardResourceTransferProcess implements Process, Procedural, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly portalRoomName: RoomName,
    private readonly targetShardName: string,
    private resourceAmounts: { [resourceType: string]: number },
    private readonly finishWorking: number,
    private creepCount: number,
    private readonly spawnedCreepNames: CreepName[],
    private readonly stopSpawningReasons: string[],
  ) {
    this.identifier = `${this.constructor.name}_${this.roomName}`
    this.codename = `${Environment.shard}${UniqueId.generateCodename(this.identifier, this.launchTime)}`
  }

  public encode(): IntershardResourceTransferProcessState {
    return {
      t: "IntershardResourceTransferProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      portalRoomName: this.portalRoomName,
      targetShardName: this.targetShardName,
      resourceAmounts: this.resourceAmounts,
      finishWorking: this.finishWorking,
      creepCount: this.creepCount,
      spawnedCreepNames: this.spawnedCreepNames,
      stopSpawningReasons: this.stopSpawningReasons,
    }
  }

  public static decode(state: IntershardResourceTransferProcessState): IntershardResourceTransferProcess {
    return new IntershardResourceTransferProcess(
      state.l,
      state.i,
      state.roomName,
      state.portalRoomName,
      state.targetShardName,
      state.resourceAmounts,
      state.finishWorking,
      state.creepCount,
      state.spawnedCreepNames,
      state.stopSpawningReasons,
    )
  }

  public static create(processId: ProcessId, roomName: RoomName, portalRoomName: RoomName, targetShardName: string, finishWorking: number, creepCount: number): IntershardResourceTransferProcess {
    return new IntershardResourceTransferProcess(
      Game.time,
      processId,
      roomName,
      portalRoomName,
      targetShardName,
      {},
      finishWorking,
      creepCount,
      [],
      [],
    )
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      `${roomLink(this.roomName)} =&gt portal ${roomLink(this.portalRoomName)} ${this.targetShardName}`,
      `${this.creepCount}cr remaining`,
      Array.from(Object.entries(this.resourceAmounts)).map(([resource, amount]) => `${amount}${coloredResourceType(resource as ResourceConstant)}`).join(","),
    ]

    if (this.stopSpawningReasons.length > 0) {
      descriptions.push(`stop spawning by: ${this.stopSpawningReasons.join(",")}`)
    }

    return descriptions.join(", ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "status", "set_resource_amount", "set_creep_count", "identifier"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "status":
        return this.processShortDescription()

      case "set_resource_amount":
        return this.setResourceAmount(components)

      case "set_creep_count":
        return this.setCreepCount(components)

      case "identifier":
        return this.identifier

      default:
        throw `Invalid command ${commandList}. see "help"`
      }
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }

  /** @throws */
  private setCreepCount(args: string[]): string {
    const listArguments = new ListArguments(args)
    const oldValue = this.creepCount
    this.creepCount = listArguments.int(0, "creep count").parse({min: 0})

    return `creep count set to ${this.creepCount} (from ${oldValue})`
  }

  /** @throws */
  private setResourceAmount(args: string[]): string {
    const listArguments = new ListArguments(args)
    const resourceType = listArguments.resourceType(0, "resource type").parse()
    const amount = listArguments.int(1, "amount").parse({ min: 0 })

    this.resourceAmounts[resourceType] = amount

    return `${amount} ${coloredResourceType(resourceType)} set`
  }

  public runOnTick(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return
    }

    const creeps = World.resourcePools.getCreeps(this.roomName, this.taskIdentifier, () => true)
    creeps.forEach(creep => {
      if (creep.spawning !== true) {
        return
      }
      if (this.spawnedCreepNames.includes(creep.name) === true) {
        return
      }
      this.spawnedCreepNames.push(creep.name)
      this.creepCount -= 1
    })

    const shouldSpawn = ((): boolean => {
      if (creeps.length >= 1) {
        return false
      }
      if (this.creepCount <= 0) {
        return false
      }
      if (Array.from(Object.values(this.resourceAmounts)).some(amount => amount > 0) !== true) {
        return false
      }
      return true
    })()

    if (shouldSpawn === true) {
      this.spawnHauler(roomResource.room.energyCapacityAvailable)
    }

    World.resourcePools.assignTasks(
      this.roomName,
      this.taskIdentifier,
      CreepPoolAssignPriority.Low,
      creep => {
        const task = this.newTaskFor(creep, roomResource)
        if (task == null) {
          return null
        }
        return FleeFromAttackerTask.create(task)
      },
      () => true,
    )
  }

  private spawnHauler(energyCapacity: number): void {
    const bodyBase: BodyPartConstant[] = [MOVE, MOVE, MOVE, MOVE]
    const bodyUnit: BodyPartConstant[] = [CARRY, MOVE]
    const unitMaxCount = ((): number => {
      if (testing === true) {
        return 2
      }
      return Math.floor((GameConstants.creep.body.bodyPartMaxCount - bodyBase.length) / bodyUnit.length)
    })()
    const body = CreepBody.create([], bodyUnit, energyCapacity, unitMaxCount)

    body.sort((lhs, rhs) => {
      if (lhs === rhs) {
        return 0
      }
      return lhs === MOVE ? 1 : -1
    })
    body.unshift(...bodyBase)

    World.resourcePools.addSpawnCreepRequest(this.roomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [],
      body,
      initialTask: null,
      taskIdentifier: this.taskIdentifier,
      parentRoomName: null,
    })
  }

  private newTaskFor(creep: Creep, roomResource: OwnedRoomResource): CreepTask | null {
    if (creep.store.getUsedCapacity() > 0) {
      if (creep.room.name === this.portalRoomName) {
        const portals = creep.room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_PORTAL } }) as StructurePortal[]
        const targetPortal = portals.find(portal => {
          if (portal.destination instanceof RoomPosition) {
            return false
          }
          if (portal.destination.shard !== this.targetShardName) {
            return false
          }
          return true
        })

        if (targetPortal == null) {
          this.addStopSpawningReason(StopSpawningReasons.noPortal)
          return null
        }
        if (creep.pos.getRangeTo(targetPortal.pos) > 1) {
          return MoveToTask.create(targetPortal.pos, 1)
        }
        // InterShardMemoryWatcher?.request() // TODO:
        return MoveToTask.create(targetPortal.pos, 0)
      }
      const waypoints = GameMap.getWaypoints(creep.room.name, this.portalRoomName) ?? []
      return MoveToRoomTask.create(this.portalRoomName, waypoints)
    }

    if (creep.room.name !== this.roomName) {
      const waypoints = GameMap.getWaypoints(creep.room.name, this.roomName) ?? []
      return MoveToRoomTask.create(this.portalRoomName, waypoints)
    }

    if (creep.ticksToLive != null && creep.ticksToLive < this.finishWorking) {
      return RunApiTask.create(SuicideApiWrapper.create())
    }

    const terminal = roomResource.activeStructures.terminal
    if (terminal == null) {
      creep.say("no trmnal")
      return null
    }

    const resource = this.haulResource(creep.store.getFreeCapacity(), terminal)
    if (resource == null) {
      creep.say("finished")
      return RunApiTask.create(SuicideApiWrapper.create())  // FixMe: ここ
    }

    return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(terminal, resource))
  }

  private haulResource(creepStoreCapacity: number, terminal: StructureTerminal): ResourceConstant | null {
    const result = Array.from(Object.entries(this.resourceAmounts)).find(([, amount]) => {
      if (amount <= 0) {
        return false
      }
      return true
    })
    if (result == null) {
      this.resourceAmounts = {}
      return null
    }

    const [haulResource, currentAmount] = result
    const updatedAmount = currentAmount - creepStoreCapacity
    if (updatedAmount > 0) {
      this.resourceAmounts[haulResource] = updatedAmount
    } else {
      delete this.resourceAmounts[haulResource]
    }
    return haulResource as ResourceConstant
  }

  private addStopSpawningReason(reason: string): void {
    if (this.stopSpawningReasons.includes(reason) === true) {
      return
    }
    this.stopSpawningReasons.push(reason)
  }
}
