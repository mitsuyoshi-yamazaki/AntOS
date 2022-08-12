import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { coloredText, roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { CreepBody } from "utility/creep_body"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { SuicideApiWrapper } from "v5_object_task/creep_task/api_wrapper/suicide_api_wrapper"
import { CommodityConstant, DepositConstant, isResourceConstant, MineralBaseCompoundsConstant, MineralBoostConstant, MineralConstant } from "utility/resource"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { processLog } from "os/infrastructure/logger"
import { OperatingSystem } from "os/os"
import { ProcessDecoder } from "process/process_decoder"
import { PickupApiWrapper } from "v5_object_task/creep_task/api_wrapper/pickup_api_wrapper"
import { MessageObserver } from "os/infrastructure/message_observer"
import { ListArguments } from "os/infrastructure/console_command/utility/list_argument_parser"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { RoomResources } from "room_resource/room_resources"

ProcessDecoder.register("StealResourceProcess", state => {
  return StealResourceProcess.decode(state as StealResourceProcessState)
})

const resourcePriority: ResourceConstant[] = [  // 添字の大きいほうが優先
  ...MineralConstant,
  ...MineralBaseCompoundsConstant,
  ...MineralBoostConstant,
  ...DepositConstant,
  ...CommodityConstant,
  RESOURCE_OPS,
  RESOURCE_POWER,
]

type State = "stop_spawning" | "in progress" | "finished"
type TargetType = StructureStorage | StructureTerminal | StructureFactory

export interface StealResourceProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  targetId: Id<TargetType>
  state: State
  takeAll: boolean
  creepCount: number
  finishWorking: number
  storeId: Id<StructureStorage | StructureTerminal> | null
  stopSpawningReasons: string[]
}

export class StealResourceProcess implements Process, Procedural, MessageObserver {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private readonly targetId: Id<TargetType>,
    private state: State,
    private readonly takeAll: boolean,
    private creepCount: number,
    private readonly finishWorking: number,
    private readonly storeId: Id<StructureStorage | StructureTerminal> | null,
    private stopSpawningReasons: string[],
  ) {
    this.identifier = `${this.constructor.name}_${this.launchTime}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): StealResourceProcessState {
    return {
      t: "StealResourceProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      targetId: this.targetId,
      state: this.state,
      takeAll: this.takeAll,
      creepCount: this.creepCount,
      finishWorking: this.finishWorking,
      storeId: this.storeId,
      stopSpawningReasons: this.stopSpawningReasons,
    }
  }

  public static decode(state: StealResourceProcessState): StealResourceProcess {
    return new StealResourceProcess(state.l, state.i, state.p, state.tr, state.w, state.targetId, state.state, state.takeAll, state.creepCount, state.finishWorking, state.storeId, state.stopSpawningReasons ?? [])
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], targetId: Id<TargetType>, takeAll: boolean, creepCount: number, finishWorkig: number, options?: {storeId?: Id<StructureStorage | StructureTerminal>}): StealResourceProcess {
    return new StealResourceProcess(
      Game.time,
      processId,
      parentRoomName,
      targetRoomName,
      waypoints,
      targetId,
      "in progress",
      takeAll,
      creepCount,
      finishWorkig,
      options?.storeId ?? null,
      [],
    )
  }

  public processShortDescription(): string {
    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    const descriptions: string[] = [
      `${roomLink(this.targetRoomName)} ${this.state}`,
      `${creepCount}cr`,
    ]
    if (this.stopSpawningReasons.length > 0) {
      descriptions.push(`spawn stopped due to: ${this.stopSpawningReasons.join(", ")}`)
    }
    return descriptions.join(", ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "set_creep_count", "stop", "resume"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "set_creep_count": {
        const listArguments = new ListArguments(components)
        const count = listArguments.int(0, "creep count").parse({ min: 1, max: 10 })
        const oldValue = this.creepCount
        this.creepCount = count
        return `set creep count ${count} (from ${oldValue})`
      }

      case "resume": {
        const oldValues = [...this.stopSpawningReasons]
        this.stopSpawningReasons = []
        if (this.state === "stop_spawning") {
          this.state = "in progress"
        }
        return `resumed (stopped reasons: ${oldValues.join(", ")})`
      }

      case "stop":
        this.addStopSpawningReason("manual")
        return "ok"

      default:
        throw `Invalid command ${commandList}. see "help"`
      }
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }

  public runOnTick(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.parentRoomName)
    if (roomResource == null) {
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }

    const resourceStore = ((): StructureTerminal | StructureStorage | null => {
      if (this.storeId != null) {
        const store = Game.getObjectById(this.storeId)
        if (store != null) {
          return store
        }
      }

      if (roomResource.activeStructures.terminal != null && roomResource.activeStructures.terminal.my === true && roomResource.activeStructures.terminal.store.getFreeCapacity() > 1500) {
        return roomResource.activeStructures.terminal
      }
      if (roomResource.activeStructures.storage != null && roomResource.activeStructures.storage.my === true) {
        return roomResource.activeStructures.storage
      }
      return null
    } )()
    if (resourceStore == null) {
      return
    }

    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    if (this.state === "finished" && creepCount <= 0) {
      processLog(this, `${coloredText("[Finished]", "info")} no more valuable resources in ${roomLink(this.targetRoomName)}`)
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }
    const numberOfCreeps = ((): number => {
      if (this.state === "stop_spawning") {
        return 0
      }
      const targetRoom = Game.rooms[this.targetRoomName]
      if (targetRoom?.controller != null) {
        if (this.targetRoomName !== this.parentRoomName && targetRoom.controller.safeMode != null) {
          this.state = "stop_spawning"
          return 0
        }
      }
      return this.creepCount
    })()
    if (this.state !== "finished" && creepCount < numberOfCreeps && this.stopSpawningReasons.length <= 0) {
      this.requestHauler(roomResource)
    }

    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.newTaskFor(creep, resourceStore),
      () => true,
    )
  }

  private requestHauler(roomResource: OwnedRoomResource): void {
    const energyCapacity = roomResource.room.energyCapacityAvailable
    const body = ((): BodyPartConstant[] => {
      if (this.targetRoomName === this.parentRoomName) {
        if (roomResource.controller.level < 7) {
          return CreepBody.create([], [CARRY, CARRY, MOVE], energyCapacity, 6)
        }
        return CreepBody.create([], [CARRY, CARRY, MOVE], energyCapacity, 16)
      } else {
        return CreepBody.create([], [CARRY, MOVE], energyCapacity, 25)
      }
    })()
    body.sort((lhs, rhs) => {
      if (lhs === rhs) {
        return 0
      }
      if (lhs === MOVE) {
        return 1
      }
      return -1
    })

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

  private newTaskFor(creep: Creep, store: StructureStorage | StructureTerminal): CreepTask | null {
    if (creep.room.name === this.parentRoomName) {
      const resourceType = Object.keys(creep.store).find(resource => {
        if (!isResourceConstant(resource)) {
          return false
        }
        return true
      }) as ResourceConstant | null
      if (resourceType != null) {
        return MoveToTargetTask.create(TransferResourceApiWrapper.create(store, resourceType))
      }
    }

    if (creep.room.name === this.targetRoomName) {
      if (creep.store.getFreeCapacity() > 0) {

        const droppedResource = creep.room.find(FIND_DROPPED_RESOURCES).find(resource => resourcePriority.includes(resource.resourceType) === true)
        if (droppedResource != null) {
          return FleeFromAttackerTask.create(MoveToTargetTask.create(PickupApiWrapper.create(droppedResource)))
        }

        const target = Game.getObjectById(this.targetId)
        if (target != null) {
          const resourceType = this.resourceToSteal(target)
          const shouldFinish = ((): boolean => {
            if (resourceType == null) {
              return true
            }
            if (this.takeAll !== true && resourcePriority.includes(resourceType) !== true) {
              return true
            }
            return false
          })()
          if (shouldFinish === true) {
            this.state = "finished"
          }
          if (resourceType != null) {
            return FleeFromAttackerTask.create(MoveToTargetTask.create(WithdrawResourceApiWrapper.create(target, resourceType)))
          }
        }
        const waypoints = [...this.waypoints].reverse()
        return FleeFromAttackerTask.create(MoveToRoomTask.create(this.parentRoomName, waypoints))
      }
    }

    if (creep.store.getUsedCapacity() <= 0) {
      if (creep.ticksToLive != null && (creep.ticksToLive < this.finishWorking)) {
        return RunApiTask.create(SuicideApiWrapper.create())
      }
      if (creep.room.name === this.parentRoomName) {
        return FleeFromAttackerTask.create(MoveToRoomTask.create(this.targetRoomName, this.waypoints))
      } else {
        return FleeFromAttackerTask.create(MoveToRoomTask.create(this.targetRoomName, []))
      }
    }

    return FleeFromAttackerTask.create(MoveToRoomTask.create(this.parentRoomName, []))
  }

  private resourceToSteal(target: TargetType): ResourceConstant | null {
    const resourceType = (Object.keys(target.store) as ResourceConstant[])
      .sort((lhs, rhs) => {
        return resourcePriority.indexOf(rhs) - resourcePriority.indexOf(lhs)
      })[0]
    return resourceType ?? null
  }

  private addStopSpawningReason(reason: string): void {
    if (this.stopSpawningReasons.includes(reason) === true) {
      return
    }
    this.stopSpawningReasons.push(reason)
  }
}
