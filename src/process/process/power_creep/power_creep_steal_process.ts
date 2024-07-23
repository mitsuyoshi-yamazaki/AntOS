import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
import { roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { ProcessDecoder } from "process/process_decoder"
import { DeployedPowerCreep, isDeployedPowerCreep, PowerCreepName } from "prototype/power_creep"
import { SystemCalls } from "os/system_calls"
import { PowerCreepProcess } from "./power_creep_process"
import { moveToRoom } from "script/move_to_room"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { RoomResources } from "room_resource/room_resources"
import { strictEntries } from "shared/utility/strict_entries"
import { CommodityConstant, DepositConstant, MineralBaseCompoundsConstant, MineralBoostConstant, MineralConstant } from "shared/utility/resource"
import { GameMap } from "game/game_map"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"

ProcessDecoder.register("PowerCreepStealProcess", state => {
  return PowerCreepStealProcess.decode(state as PowerCreepStealProcessState)
})

type StealTarget = StructureTerminal | StructureStorage
type TransferTarget = StructureTerminal | StructureStorage

const resourcePriority: ResourceConstant[] = [  // 添字の小さいほうが優先
  RESOURCE_POWER,
  RESOURCE_OPS,
  ...CommodityConstant,
  ...DepositConstant,
  ...MineralBoostConstant,
  ...MineralBaseCompoundsConstant,
  ...MineralConstant,
]

type PowerCreepStateRenewing = {
  readonly case: "renewing"
  readonly powerSpawnId: Id<StructurePowerSpawn>
}
type PowerCreepStateHeading = {
  readonly case: "heading"
  stealTarget: {
    readonly id: Id<StealTarget>
    readonly resourceType: ResourceConstant
  } | null
  regenTargetId: Id<Source> | null
  readonly waypoints: RoomName[]
}
type PowerCreepStateReturning = {
  readonly case: "returning"
  transferTarget: {
    readonly id: Id <TransferTarget>
    readonly resourceType: ResourceConstant
} | null
  readonly waypoints: RoomName[]
}
type PowerCreepState = PowerCreepStateRenewing | PowerCreepStateHeading | PowerCreepStateReturning

interface PowerCreepStealProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetRoomName: RoomName
  readonly targetIds: Id<StealTarget>[]
  readonly powerCreepName: PowerCreepName
  readonly powerCreepProcessId: ProcessId
  readonly powerCreepState: PowerCreepState
  readonly shot: boolean | null
}

export class PowerCreepStealProcess implements Process, Procedural {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly targetRoomName: RoomName,
    private readonly targetIds: Id<StealTarget>[],
    private readonly powerCreepName: PowerCreepName,
    private readonly powerCreepProcessId: ProcessId,
    private powerCreepState: PowerCreepState,
    private shot: boolean | null,
  ) {
    this.identifier = `${this.constructor.name}_${this.targetRoomName}`
  }

  public encode(): PowerCreepStealProcessState {
    return {
      t: "PowerCreepStealProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetRoomName: this.targetRoomName,
      targetIds: this.targetIds,
      powerCreepName: this.powerCreepName,
      powerCreepProcessId: this.powerCreepProcessId,
      powerCreepState: this.powerCreepState,
      shot: this.shot,
    }
  }

  public static decode(state: PowerCreepStealProcessState): PowerCreepStealProcess {
    return new PowerCreepStealProcess(
      state.l,
      state.i,
      state.roomName,
      state.targetRoomName,
      state.targetIds,
      state.powerCreepName,
      state.powerCreepProcessId,
      state.powerCreepState,
      state.shot,
    )
  }

  public static create(processId: ProcessId, roomName: RoomName, targetRoomName: RoomName, powerCreepName: PowerCreepName, suspendedPowerCreepProcessId: ProcessId, targetIds: Id<StealTarget>[]): PowerCreepStealProcess {
    return new PowerCreepStealProcess(
      Game.time,
      processId,
      roomName,
      targetRoomName,
      targetIds,
      powerCreepName,
      suspendedPowerCreepProcessId,
      {
        case: "returning",
        transferTarget: null,
        waypoints: [],
      },
      null,
    )
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      `${roomLink(this.roomName)} =&gt ${roomLink(this.targetRoomName)}`,
    ]

    const powerCreep = Game.powerCreeps[this.powerCreepName]
    if (powerCreep?.room != null) {
      descriptions.push(`in ${roomLink(powerCreep.room.name)}`)
    }

    if (this.shot == null) {
      descriptions.push("safety: unknown")
    } else {
      if (this.shot === true) {
        descriptions.push("safety: danger")
      } else {
        descriptions.push("safety: safe")
      }
    }

    descriptions.join(`${this.targetIds.length} targets`)

    return descriptions.join(", ")
  }

  public runOnTick(): void {
    const powerCreepProcess = SystemCalls.systemCall()?.processOf(this.powerCreepProcessId) as PowerCreepProcess
    if (powerCreepProcess == null) {
      PrimitiveLogger.log(`no powerCreepProcess for ID ${this.powerCreepProcessId}`)
      SystemCalls.systemCall()?.suspendProcess(this.processId)
      return
    }
    if (SystemCalls.systemCall()?.isRunning(this.powerCreepProcessId) === true) {
      PrimitiveLogger.log(`suspend powerCreepProcess ${this.powerCreepProcessId}`)
      SystemCalls.systemCall()?.suspendProcess(this.powerCreepProcessId)
    }

    const powerCreep = Game.powerCreeps[this.powerCreepName]
    if (powerCreep == null || !isDeployedPowerCreep(powerCreep)) {
      this.suicide("power creep not deployed")
      return
    }

    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      this.suicide("room not mine")
      return
    }

    this.runPowerCreep(powerCreep, roomResource)
  }

  private runPowerCreep(powerCreep: DeployedPowerCreep, roomResource: OwnedRoomResource): void {
    switch (this.powerCreepState.case) {
    case "renewing":
      if (powerCreep.ticksToLive > 3850) {
        this.powerCreepState = {
          case: "heading",
          stealTarget: null,
          regenTargetId: this.getRegenTargetSource(roomResource)?.id ?? null,
          waypoints: GameMap.getWaypoints(this.roomName, this.targetRoomName) ?? [],
        }
        return
      }

      this.runRenew(powerCreep, this.powerCreepState)
      return

    case "heading":
      if (powerCreep.room.name === this.targetRoomName) {
        if (powerCreep.hits < powerCreep.hitsMax) {
          this.shot = true
          this.powerCreepState = {
            case: "returning",
            transferTarget: null,
            waypoints: GameMap.getWaypoints(this.targetRoomName, this.roomName) ?? [],
          }
          return
        }
        if (this.shot == null) {
          this.shot = false
        }

        if (powerCreep.store.getFreeCapacity() <= 0) {
          this.powerCreepState = {
            case: "returning",
            transferTarget: null,
            waypoints: GameMap.getWaypoints(this.targetRoomName, this.roomName) ?? [],
          }
          return
        }
        if (this.powerCreepState.stealTarget != null) {
          this.runSteal(powerCreep, this.powerCreepState.stealTarget.id, this.powerCreepState.stealTarget.resourceType)
          return
        }
        this.steal(powerCreep, roomResource, this.powerCreepState)
      } else {
        if (powerCreep.room.name === this.roomName && this.powerCreepState.regenTargetId != null) {
          this.operateRegenSource(powerCreep, this.powerCreepState, this.powerCreepState.regenTargetId)
          return
        }
        this.moveToTargetRoom(powerCreep, this.powerCreepState)
      }
      return

    case "returning":
      if (powerCreep.room.name === this.roomName) {
        if (powerCreep.store.getUsedCapacity() <= 0) {
          if (this.shot === true || this.targetIds.length <= 0) {
            this.suicide("shot or no target")
            return
          }

          const powerSpawn = roomResource.activeStructures.powerSpawn
          if (powerSpawn == null) {
            this.suicide("no power spawn2")
            return
          }
          this.renew(powerCreep, roomResource)
          return
        }
        if (this.powerCreepState.transferTarget != null) {
          if (powerCreep.store.getUsedCapacity(this.powerCreepState.transferTarget.resourceType) <= 0) {
            this.powerCreepState.transferTarget = null
            this.transfer(powerCreep, roomResource, this.powerCreepState)
            return
          }
          this.runTransfer(powerCreep, this.powerCreepState.transferTarget.id, this.powerCreepState.transferTarget.resourceType)
          return
        }
        this.transfer(powerCreep, roomResource, this.powerCreepState)
      } else {
        this.moveToMyRoom(powerCreep, this.powerCreepState)
      }
      return

    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = this.powerCreepState
      return
    }
    }
  }

  private steal(powerCreep: DeployedPowerCreep, roomResource: OwnedRoomResource, state: PowerCreepStateHeading): void {
    const stealTarget = this.getStealTarget()
    if (stealTarget == null) {
      this.targetIds.splice(0, this.targetIds.length)

      this.powerCreepState = {
        case: "returning",
        transferTarget: null,
        waypoints: GameMap.getWaypoints(this.targetRoomName, this.roomName) ?? [],
      }
      return
    }

    state.stealTarget = {...stealTarget}
    this.runSteal(powerCreep, stealTarget.id, stealTarget.resourceType)
  }

  private runSteal(powerCreep: DeployedPowerCreep, targetId: Id<StealTarget>, resourceType: ResourceConstant): void {
    const target = Game.getObjectById(targetId)
    if (target == null || target.store.getUsedCapacity(resourceType) <= 0) {
      this.powerCreepState = {
        case: "heading",
        stealTarget: null,
        regenTargetId: null,
        waypoints: [],
      }
      return
    }

    if (powerCreep.pos.isNearTo(target) === true) {
      powerCreep.withdraw(target, resourceType)
      return
    }

    powerCreep.moveTo(target, this.moveToOptions())
  }

  private getStealTarget(): { id: Id<StealTarget>, resourceType: ResourceConstant } | null {
    const targets = this.targetIds.flatMap((id): StealTarget[] => {
      const candidate = Game.getObjectById(id)
      if (candidate == null) {
        return []
      }
      return [candidate]
    })

    for (const prioritizeResourceType of resourcePriority) {
      const target = targets.find(target => target.store.getUsedCapacity(prioritizeResourceType) > 0)
      if (target != null) {
        return {
          id: target.id,
          resourceType: prioritizeResourceType,
        }
      }
    }
    return null
  }

  private transfer(powerCreep: DeployedPowerCreep, roomResource: OwnedRoomResource, state: PowerCreepStateReturning): void {
    const targetInfo = ((): [TransferTarget, ResourceConstant] | null => {
      if (state.transferTarget != null) {
        const target = Game.getObjectById(state.transferTarget.id)
        if (target != null) {
          return [target, state.transferTarget.resourceType]
        }
      }

      const transferResourceType = (strictEntries(powerCreep.store) as [ResourceConstant, number][]).find(([, amount]) => amount > 0)
      if (transferResourceType == null) {
        return null
      }
      const newTarget = this.getTransferTarget(roomResource)
      if (newTarget == null) {
        return null
      }
      return [newTarget, transferResourceType[0]]
    })()

    if (targetInfo == null) {
      powerCreep.say("no str")
      this.suicide("no storage")
      return
    }

    state.transferTarget = {
      id: targetInfo[0].id,
      resourceType: targetInfo[1],
    }
    this.runTransfer(powerCreep, state.transferTarget.id, state.transferTarget.resourceType)
  }

  private getTransferTarget(roomResource: OwnedRoomResource): TransferTarget | null {
    const terminal = roomResource.activeStructures.terminal
    if (terminal != null && terminal.store.getFreeCapacity() > 0) {
      return terminal
    }

    const storage = roomResource.activeStructures.storage
    if (storage != null && storage.store.getFreeCapacity() > 0) {
      return storage
    }

    return null
  }

  private runTransfer(powerCreep: DeployedPowerCreep, targetId: Id<TransferTarget>, resourceType: ResourceConstant): void {
    const target = Game.getObjectById(targetId)
    if (target == null) {
      this.powerCreepState = {
        case: "returning",
        transferTarget: null,
        waypoints: [],
      }
      return
    }

    if (powerCreep.store.getUsedCapacity(resourceType) <= 0) {
      this.powerCreepState = {
        case: "returning",
        transferTarget: null,
        waypoints: [],
      }
      return
    }

    if (powerCreep.pos.isNearTo(target) === true) {
      powerCreep.transfer(target, resourceType)
      return
    }
    powerCreep.moveTo(target, this.moveToOptions())
  }

  private renew(powerCreep: DeployedPowerCreep, roomResource: OwnedRoomResource): void {
    const powerSpawn = roomResource.activeStructures.powerSpawn
    if (powerSpawn == null) {
      this.suicide("no power spawn")
      return
    }

    this.powerCreepState = {
      case: "renewing",
      powerSpawnId: powerSpawn.id,
    }
    this.runRenew(powerCreep, this.powerCreepState)
  }

  private runRenew(powerCreep: DeployedPowerCreep, renewState: PowerCreepStateRenewing): void {
    const powerSpawn = Game.getObjectById(renewState.powerSpawnId)
    if (powerSpawn == null) {
      return
    }
    if (powerCreep.pos.isNearTo(powerSpawn) === true) {
      powerCreep.renew(powerSpawn)
      return
    }

    powerCreep.moveTo(powerSpawn, this.moveToOptions())
  }

  private moveToTargetRoom(powerCreep: DeployedPowerCreep, state: PowerCreepStateHeading): void {
    moveToRoom(powerCreep, this.targetRoomName, state.waypoints)
  }

  private moveToMyRoom(powerCreep: DeployedPowerCreep, state: PowerCreepStateReturning): void {
    moveToRoom(powerCreep, this.roomName, state.waypoints)
  }

  private suicide(message: string): void {
    PrimitiveLogger.log(`${this.constructor.name} ${roomLink(this.roomName)} suspend: ${message}`)
    SystemCalls.systemCall()?.resumeProcess(this.powerCreepProcessId)
    SystemCalls.systemCall()?.suspendProcess(this.processId)
  }

  private moveToOptions(): MoveToOpts {
    return {
      maxRooms: 1,
      reusePath: 10,
      maxOps: 800,
    }
  }


  // ---- Power ---- //
  private operateRegenSource(powerCreep: DeployedPowerCreep, state: PowerCreepStateHeading, regenTargetId: Id<Source>): void {
    switch (this.powerStatus(powerCreep, PWR_REGEN_SOURCE)) {
    case "unavailable":
    case "cooling down":
      return
    case "available":
      break
    }

    const source = Game.getObjectById(regenTargetId)
    if (source == null) {
      state.regenTargetId = null
      return
    }
    if (powerCreep.pos.getRangeTo(source) <= 3) {
      powerCreep.usePower(PWR_REGEN_SOURCE, source)
      return
    }

    powerCreep.moveTo(source, this.moveToOptions())
  }

  private getRegenTargetSource(roomResource: OwnedRoomResource): Source | null {
    if (roomResource.hostiles.creeps.length > 0) {
      return roomResource.sources.find(source => {
        if (source.effects == null) {
          if (source.pos.findInRange(FIND_HOSTILE_CREEPS, 5).length > 0) {
            return false
          }
          return true
        }
        return source.effects.some(effect => effect.effect === PWR_REGEN_SOURCE) !== true
      }) ?? null
    }
    return roomResource.sources.find(source => {
      if (source.effects == null) {
        return true
      }
      return source.effects.some(effect => effect.effect === PWR_REGEN_SOURCE) !== true
    }) ?? null
  }

  // private operateGenerateOps(powerCreep: DeployedPowerCreep): void {
  //   switch (this.powerStatus(powerCreep, PWR_GENERATE_OPS)) {
  //   case "unavailable":
  //   case "cooling down":
  //     return
  //   case "available":
  //     powerCreep.usePower(PWR_GENERATE_OPS)
  //     return
  //   }
  // }

  private powerStatus(powerCreep: DeployedPowerCreep, power: PowerConstant): "unavailable" | "cooling down" | "available" {
    const powerStatus = powerCreep.powers[power]
    if (powerStatus == null || powerStatus.cooldown == null) {
      return "unavailable"
    }
    if (powerStatus.cooldown > 0) {
      return "cooling down"
    }
    return "available"
  }
}
