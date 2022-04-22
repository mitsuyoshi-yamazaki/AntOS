import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { coloredText, roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { PowerCreepName } from "prototype/power_creep"
import { defaultMoveToOptions } from "prototype/creep"
import { GameConstants, randomDirection } from "utility/constants"
import { OperatingSystem } from "os/os"
import { moveToRoom } from "script/move_to_room"
import { ProcessDecoder } from "process/process_decoder"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { RoomResources } from "room_resource/room_resources"
import { powerName } from "utility/power"
import { OnHeapLogger } from "utility/on_heap_logger"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { MessageObserver } from "os/infrastructure/message_observer"

ProcessDecoder.register("PowerCreepProcess", state => {
  return PowerCreepProcess.decode(state as PowerCreepProcessState)
})

type OperationResult = {
  readonly blocksFurtherOperations: boolean
}

const programErrorOnHeapLogger = new OnHeapLogger({
  logLevel: "program error",
  logInterval: 100,
})

type RunningState = "normal" | "suicide"

export interface PowerCreepProcessState extends ProcessState {
  /** parent room name */
  r: RoomName

  /** power creep name */
  p: PowerCreepName

  readonly runningState: RunningState
}

// RoomObject.effects は undefined のことがあるため注意すること
/*
PowerCreep.create("power_creep_0000", POWER_CLASS.OPERATOR)
Game.powerCreeps["power_creep_0000"].spawn(Game.getObjectById("60ec7853cb384f1559d71ae7"))
Game.powerCreeps["power_creep_0000"].renew(Game.getObjectById("60ec7853cb384f1559d71ae7"))
Game.powerCreeps["power_creep_0000"].usePower(PWR_GENERATE_OPS)
Game.io("launch -l PowerCreepProcess room_name=W9S24 power_creep_name=power_creep_0002")
*/
export class PowerCreepProcess implements Process, Procedural, MessageObserver {
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly identifier: string

  private operateSpawnTargetId: Id<StructureSpawn> | null = null
  private operateFactoryTargetId: Id<StructureFactory> | null = null

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly powerCreepName: PowerCreepName,
    private runningState: RunningState,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}_${this.powerCreepName}`
  }

  public encode(): PowerCreepProcessState {
    return {
      t: "PowerCreepProcess",
      l: this.launchTime,
      i: this.processId,
      r: this.parentRoomName,
      p: this.powerCreepName,
      runningState: this.runningState,
    }
  }

  public static decode(state: PowerCreepProcessState): PowerCreepProcess | null {
    return new PowerCreepProcess(state.l, state.i, state.r, state.p, state.runningState ?? "normal")  // FixMe: Migration
  }

  public static create(processId: ProcessId, roomName: RoomName, powerCreepName: PowerCreepName): PowerCreepProcess {
    return new PowerCreepProcess(Game.time, processId, roomName, powerCreepName, "normal")
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      roomLink(this.parentRoomName),
      this.powerCreepName,
    ]
    const powerCreep = Game.powerCreeps[this.powerCreepName]
    if (powerCreep == null) {
      descriptions.push("removed")
    } else {
      if (powerCreep.spawnCooldownTime != null) {
        const spawnCooldown = (powerCreep.spawnCooldownTime - Date.now()) / (3600 * 1000)
        const cooldownDescription = Math.floor(spawnCooldown * 10) / 10
        descriptions.push(`spawn cooldown: ${cooldownDescription} hours`)
      } else {
        if (powerCreep.room == null) {
          descriptions.push("not spawned")
        }
      }
    }
    return descriptions.join(" ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "suicide"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "suicide":
        this.runningState = "suicide"
        return "ok"

      default:
        throw `Invalid command ${commandList}. see "help"`
      }
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }

  public runOnTick(): void {
    programErrorOnHeapLogger.refresh(1000)

    const powerCreep = Game.powerCreeps[this.powerCreepName]
    if (powerCreep == null) {
      PrimitiveLogger.fatal(`${this.identifier} ${this.processId} Power creep ${this.powerCreepName} lost ${roomLink(this.parentRoomName)}`)
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }

    const roomResource = RoomResources.getOwnedRoomResource(this.parentRoomName)
    if (roomResource == null) {
      return
    }

    switch (this.runningState) {
    case "suicide":
      this.suicide(powerCreep, roomResource)
      return
    case "normal":
      break
    }

    if (powerCreep.room == null) {
      if (powerCreep.spawnCooldownTime != null) {
        return
      }
      if (roomResource.activeStructures.powerSpawn == null) {
        PrimitiveLogger.fatal(`${this.identifier} ${this.processId} ${roomLink(this.parentRoomName)} doesn't have power spawn`)
        OperatingSystem.os.suspendProcess(this.processId)
        return
      }
      this.spawn(powerCreep, roomResource.activeStructures.powerSpawn)
      return
    }

    if (powerCreep.room.name !== this.parentRoomName) {
      moveToRoom(powerCreep, this.parentRoomName, [])
      this.operateGenerateOps(powerCreep)
      return
    }

    if (roomResource.controller.isPowerEnabled !== true) {
      powerCreep.say("enable pwr")
      this.enablePower(powerCreep, roomResource.controller)
      return
    }

    if (powerCreep.ticksToLive != null && powerCreep.ticksToLive < 1000) {
      if (roomResource.activeStructures.powerSpawn != null) {
        this.renewPowerCreep(powerCreep, roomResource.activeStructures.powerSpawn)
        this.operateGenerateOps(powerCreep)
        return
      }
    }

    const powerOperationPriority: PowerConstant[] = [
      PWR_GENERATE_OPS,
      PWR_REGEN_SOURCE,
      PWR_OPERATE_SPAWN,
      PWR_OPERATE_FACTORY,
    ]
    const { executed } = this.operatePowers(powerCreep, powerOperationPriority, roomResource)
    if (executed) {
      return
    }

    if ((powerCreep.store.getUsedCapacity(RESOURCE_OPS) > 300) || (powerCreep.store.getUsedCapacity() > (powerCreep.store.getCapacity() * 0.6))) {
      const opsStorage = roomResource.activeStructures.terminal || roomResource.activeStructures.storage
      if (opsStorage != null) {
        this.transferOps(powerCreep, opsStorage)
        return
      }
    }

    this.moveToWaitingPosition(powerCreep, roomResource)
  }

  private suicide(powerCreep: PowerCreep, roomResource: OwnedRoomResource): void {
    if (powerCreep.room == null) {
      OperatingSystem.os.killProcess(this.processId)
      return
    }

    powerCreep.say("suicide")

    if (powerCreep.store.getUsedCapacity(RESOURCE_OPS) <= 0) {
      powerCreep.suicide()
      return
    }

    const storage = ((): StructureTerminal | StructureStorage | null => {
      if (roomResource.activeStructures.terminal != null && roomResource.activeStructures.terminal.store.getFreeCapacity() > 1000) {
        return roomResource.activeStructures.terminal
      }
      if (roomResource.activeStructures.storage != null && roomResource.activeStructures.storage.store.getFreeCapacity() > 1000) {
        return roomResource.activeStructures.storage
      }
      return null
    })()

    if (storage == null) {
      powerCreep.suicide()
      return
    }

    this.transferOps(powerCreep, storage, {all: true})
  }

  private spawn(powerCreep: PowerCreep, powerSpawn: StructurePowerSpawn): void {
    const spawnResult = powerCreep.spawn(powerSpawn)
    switch (spawnResult) {
    case OK:
      return
    case ERR_NOT_OWNER:
    case ERR_BUSY:
    case ERR_INVALID_TARGET:
    case ERR_TIRED:
    case ERR_RCL_NOT_ENOUGH:
      PrimitiveLogger.fatal(`${this.identifier} ${this.processId} cannot spawn power creep ${this.powerCreepName} in ${roomLink(this.parentRoomName)}`)
      return
    }
  }

  /**
 * @param powers 優先順位順：先頭からblocksFurtherOperations == trueになるまで実行する。GENERATE_OPS等他の作業を妨害しないものを先頭に置く
 */
  private operatePowers(powerCreep: PowerCreep, powers: PowerConstant[], roomResource: OwnedRoomResource): {executed: boolean} {
    for (const power of powers) {
      const operationResult = this.operate(powerCreep, power, roomResource)
      if (operationResult.blocksFurtherOperations) {
        return {
          executed: true,
        }
      }
    }

    return {
      executed: false,
    }
  }

  private operate(powerCreep: PowerCreep, power: PowerConstant, roomResource: OwnedRoomResource): OperationResult {
    if (this.powerEnabled(roomResource, power) !== true) {
      return {
        blocksFurtherOperations: false,
      }
    }
    switch (this.powerStatus(powerCreep, power)) {
    case "unavailable":
    case "cooling down":
      return {
        blocksFurtherOperations: false,
      }
    case "available":
      break
    }

    switch (power) {
    case PWR_GENERATE_OPS:
      return this.operateGenerateOps(powerCreep)

    case PWR_OPERATE_SPAWN:
      return this.operateSpawn(powerCreep, roomResource)

    case PWR_OPERATE_FACTORY:
      return this.operateFactory(powerCreep, roomResource)

    case PWR_REGEN_SOURCE:
      return this.regenSource(powerCreep, roomResource)

    case PWR_OPERATE_TOWER:
    case PWR_OPERATE_STORAGE:
    case PWR_OPERATE_LAB:
    case PWR_OPERATE_EXTENSION:
    case PWR_OPERATE_OBSERVER:
    case PWR_OPERATE_TERMINAL:
    case PWR_DISRUPT_SPAWN:
    case PWR_DISRUPT_TOWER:
    case PWR_DISRUPT_SOURCE:
    case PWR_SHIELD:
    case PWR_REGEN_MINERAL:
    case PWR_DISRUPT_TERMINAL:
    case PWR_OPERATE_POWER:
    case PWR_FORTIFY:
    case PWR_OPERATE_CONTROLLER:
      powerCreep.say(`no${power}impl`)
      return {
        blocksFurtherOperations: false
      }
    }
  }

  // ---- Operations ---- //
  private operateGenerateOps(powerCreep: PowerCreep): OperationResult {
    switch (this.powerStatus(powerCreep, PWR_GENERATE_OPS)) { // operate()以外からも呼び出されるため
    case "unavailable":
    case "cooling down":
      return {
        blocksFurtherOperations: false,
      }
    case "available":
      break
    }

    this.usePower(powerCreep, PWR_GENERATE_OPS)
    return {
      blocksFurtherOperations: false,
    }
  }

  private operateSpawn(powerCreep: PowerCreep, roomResource: OwnedRoomResource): OperationResult {
    const targetSpawn = this.getTargetObject(this.operateSpawnTargetId, PWR_OPERATE_SPAWN, roomResource.activeStructures.spawns)

    if (targetSpawn == null) {
      this.operateSpawnTargetId = null
      return {
        blocksFurtherOperations: false,
      }
    }
    this.operateSpawnTargetId = targetSpawn.id

    const operateSpawn = GameConstants.power.operateSpawn
    if (powerCreep.store.getUsedCapacity(RESOURCE_OPS) < operateSpawn.opsCost) {
      return this.withdrawOps(powerCreep, roomResource, operateSpawn.opsCost)
    }

    const { executed } = this.usePower(powerCreep, PWR_OPERATE_SPAWN, targetSpawn)
    if (executed) {
      return {
        blocksFurtherOperations: true,
      }
    }
    return {
      blocksFurtherOperations: false,
    }
  }

  private operateFactory(powerCreep: PowerCreep, roomResource: OwnedRoomResource): OperationResult {
    if (roomResource.activeStructures.factory == null) {
      return {
        blocksFurtherOperations: false,
      }
    }
    const targetFactory = this.getTargetObject(this.operateFactoryTargetId, PWR_OPERATE_FACTORY, roomResource.activeStructures.factory)

    if (targetFactory == null) {
      this.operateFactoryTargetId = null
      return {
        blocksFurtherOperations: false,
      }
    }
    this.operateFactoryTargetId = targetFactory.id

    const operateFactory = GameConstants.power.operateFactory
    if (powerCreep.store.getUsedCapacity(RESOURCE_OPS) < operateFactory.opsCost) {
      return this.withdrawOps(powerCreep, roomResource, operateFactory.opsCost)
    }

    const { executed } = this.usePower(powerCreep, PWR_OPERATE_FACTORY, targetFactory)
    if (executed) {
      return {
        blocksFurtherOperations: true,
      }
    }
    return {
      blocksFurtherOperations: false,
    }
  }

  private regenSource(powerCreep: PowerCreep, roomResource: OwnedRoomResource): OperationResult {
    const targetSource = roomResource.sources.find(source => {
      if (source.effects == null) {
        return true
      }
      return source.effects.some(effect => effect.effect === PWR_REGEN_SOURCE) !== true
    })
    if (targetSource == null) {
      return {
        blocksFurtherOperations: false,
      }
    }

    const { executed } = this.usePower(powerCreep, PWR_REGEN_SOURCE, targetSource)
    if (executed) {
      return {
        blocksFurtherOperations: true,
      }
    }
    return {
      blocksFurtherOperations: false,
    }
  }

  // ---- Power Creep Actions ---- //
  private usePower(powerCreep: PowerCreep, power: PowerConstant, target?: StructureSpawn | StructureFactory | Source): { executed: boolean } {
    const result = powerCreep.usePower(power, target)

    switch (result) {
    case OK:
      return {
        executed: true,
      }

    case ERR_NOT_IN_RANGE:
      if (target != null) {
        powerCreep.moveTo(target, defaultMoveToOptions())
        return {
          executed: true,
        }
      }
      return {
        executed: false,
      }

    case ERR_TIRED:
    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_NOT_OWNER:
    case ERR_BUSY:
    case ERR_INVALID_TARGET:
    case ERR_FULL:
    case ERR_INVALID_ARGS:
    case ERR_NO_BODYPART:
    default:
      programErrorOnHeapLogger.add(`powerCreep.usePower(${powerName(power)}) returns ${result} in ${roomLink(this.parentRoomName)}`)
      return {
        executed: false,
      }
    }
  }

  private renewPowerCreep(powerCreep: PowerCreep, powerSpawn: StructurePowerSpawn): void {
    const result = powerCreep.renew(powerSpawn)
    switch (result) {
    case OK:
      break

    case ERR_NOT_IN_RANGE:
      powerCreep.moveTo(powerSpawn, defaultMoveToOptions())
      break

    case ERR_NOT_OWNER:
    case ERR_BUSY:
    case ERR_INVALID_TARGET:
      programErrorOnHeapLogger.add(`powerCreep.renew() returns ${result} in ${roomLink(this.parentRoomName)}`)
      break
    }
  }

  private transferOps(powerCreep: PowerCreep, opsStore: StructureTerminal | StructureStorage, options?: {all?: boolean}): void {
    if (powerCreep.pos.isNearTo(opsStore) !== true) {
      powerCreep.moveTo(opsStore, defaultMoveToOptions())
      return
    }
    const amount: number | undefined = options?.all === true ? undefined : 100
    powerCreep.transfer(opsStore, RESOURCE_OPS, amount)
  }

  private moveToWaitingPosition(powerCreep: PowerCreep, roomResource: OwnedRoomResource): void {
    const waitingPosition = roomResource.roomInfoAccessor.config.getGenericWaitingPosition()
    if (waitingPosition == null) {
      powerCreep.move(randomDirection(0))
      return
    }
    powerCreep.moveTo(waitingPosition, defaultMoveToOptions())
  }

  private enablePower(powerCreep: PowerCreep, controller: StructureController): void {
    const result = powerCreep.enableRoom(controller)
    switch (result) {
    case OK:
      break

    case ERR_NOT_IN_RANGE:
      powerCreep.moveTo(controller)
      break

    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
      programErrorOnHeapLogger.add(`${this.identifier} powerCreep.enableRoom() returns ${result} ${roomLink(controller.room.name)}`)
      break
    }
  }

  private withdrawOps(powerCreep: PowerCreep, roomResource: OwnedRoomResource, opsAmount: number): OperationResult {
    const opsStore = ((): StructureTerminal | StructureStorage | null => {
      const storage = roomResource.activeStructures.storage
      if (storage != null && storage.store.getUsedCapacity(RESOURCE_OPS) > 0) {
        return storage
      }
      const terminal = roomResource.activeStructures.terminal
      if (terminal != null && terminal.store.getUsedCapacity(RESOURCE_OPS) > 0) {
        return terminal
      }
      return null
    })()

    if (opsStore != null) {
      const withdrawAmount = opsAmount - powerCreep.store.getUsedCapacity(RESOURCE_POWER)
      if (powerCreep.withdraw(opsStore, RESOURCE_OPS, withdrawAmount) === ERR_NOT_IN_RANGE) {
        powerCreep.moveTo(opsStore, defaultMoveToOptions())
      }
    }
    return {
      blocksFurtherOperations: true,
    }
  }

  // ---- Utility ---- //
  private powerEnabled(roomResource: OwnedRoomResource, power: PowerConstant): boolean {
    if (power === PWR_GENERATE_OPS || power === PWR_REGEN_SOURCE) { // TODO: コストのかからないPower全般を検出して有効化する処理を入れる
      return true
    }
    return roomResource.roomInfoAccessor.config.powerEnabled(power)
  }

  private powerStatus(powerCreep: PowerCreep, power: PowerConstant): "unavailable" | "cooling down" | "available" {
    const powerStatus = powerCreep.powers[power]
    if (powerStatus == null || powerStatus.cooldown == null) {
      return "unavailable"
    }
    if (powerStatus.cooldown > 0) {
      return "cooling down"
    }
    return "available"
  }

  private getTargetObject<T extends RoomObject>(targetId: Id<T> | null, power: PowerConstant, rawObject: T): T | null
  private getTargetObject<T extends RoomObject>(targetId: Id<T> | null, power: PowerConstant, rawObjects: T[]): T | null
  private getTargetObject<T extends RoomObject>(targetId: Id<T> | null, power: PowerConstant, arg: T | T[]): T | null {
    const rawObjects = ((): T[] => {
      if (arg instanceof Array) {
        return arg
      }
      return [arg]
    })()

    if (targetId != null) {
      const obj = Game.getObjectById(targetId)
      if (obj != null) {
        return obj
      }
    }
    const target = rawObjects.find(obj => {
      if (obj.effects == null) {  // undefinedの場合がある
        return true
      }
      if (obj.effects.some(obj => obj.effect === power)) {
        return false
      }
      return true
    })
    return target ?? null
  }
}
