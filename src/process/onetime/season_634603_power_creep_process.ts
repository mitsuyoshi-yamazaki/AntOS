import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { World } from "world_info/world_info"
import { ProcessState } from "process/process_state"
import { PowerCreepName } from "prototype/power_creep"
import { defaultMoveToOptions } from "prototype/creep"
import { OwnedRoomObjects } from "world_info/room_info"
import { randomDirection } from "utility/constants"

export interface Season634603PowerCreepProcessState extends ProcessState {
  /** parent room name */
  r: RoomName

  /** power creep name */
  p: PowerCreepName
}

/*
PowerCreep.create("power_creep_0000", POWER_CLASS.OPERATOR)
Game.powerCreeps["power_creep_0000"].spawn(Game.getObjectById("60ec7853cb384f1559d71ae7"))
Game.powerCreeps["power_creep_0000"].renew(Game.getObjectById("60ec7853cb384f1559d71ae7"))
Game.powerCreeps["power_creep_0000"].usePower(PWR_GENERATE_OPS)
Game.io("launch -l Season634603PowerCreepProcess room_name=W9S24 power_creep_name=power_creep_0002")
*/
export class Season634603PowerCreepProcess implements Process, Procedural {
  private readonly identifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    private readonly powerCreepName: PowerCreepName,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}_${this.powerCreepName}`
  }

  public encode(): Season634603PowerCreepProcessState {
    return {
      t: "Season634603PowerCreepProcess",
      l: this.launchTime,
      i: this.processId,
      r: this.parentRoomName,
      p: this.powerCreepName,
    }
  }

  public static decode(state: Season634603PowerCreepProcessState): Season634603PowerCreepProcess | null {
    return new Season634603PowerCreepProcess(state.l, state.i, state.r, state.p)
  }

  public static create(processId: ProcessId, roomName: RoomName, powerCreepName: PowerCreepName): Season634603PowerCreepProcess {
    return new Season634603PowerCreepProcess(Game.time, processId, roomName, powerCreepName)
  }

  public processShortDescription(): string {
    return `${roomLink(this.parentRoomName)} ${this.powerCreepName}`
  }

  public runOnTick(): void {
    const powerCreep = Game.powerCreeps[this.powerCreepName]
    if (powerCreep == null) {
      PrimitiveLogger.fatal(`Power creep ${this.powerCreepName} lost ${roomLink(this.parentRoomName)}`)
      return
    }
    const objects = World.rooms.getOwnedRoomObjects(this.parentRoomName)
    if (objects == null) {
      PrimitiveLogger.fatal(`${roomLink(this.parentRoomName)} lost`)
      return
    }

    this.runPowerCreep(powerCreep, objects)
  }

  private runPowerCreep(powerCreep: PowerCreep, objects: OwnedRoomObjects): void {
    if (objects.controller.isPowerEnabled !== true) {
      this.enablePower(powerCreep, objects.controller)
      return
    }

    const powerSpawn = objects.activeStructures.powerSpawn
    let isMoving = false
    if (powerSpawn == null) {
      PrimitiveLogger.fatal(`${this.identifier} ${roomLink(this.parentRoomName)} does not have power spawn`)
    } else {
      if (powerCreep.ticksToLive != null && powerCreep.ticksToLive < 1000) {
        this.renewPowerCreep(powerCreep, powerSpawn)
        isMoving = true
      }
    }

    if (isMoving !== true) {
      isMoving = this.runRegenSource(powerCreep, objects.sources)
    }

    const spawn = objects.activeStructures.spawns[0]
    if (spawn != null && (spawn.effects == null || spawn.effects.length <= 0)) {
      const opsStore = ((): StructureTerminal | StructureStorage | null => {
        const storage = objects.activeStructures.storage
        if (storage != null && storage.store.getUsedCapacity(RESOURCE_OPS) > 0) {
          return storage
        }
        const terminal = objects.activeStructures.terminal
        if (terminal != null && terminal.store.getUsedCapacity(RESOURCE_OPS) > 0) {
          return terminal
        }
        return null
      })()
      isMoving = isMoving || this.runOperateSpawn(powerCreep, spawn, opsStore, isMoving)
    }

    const store = ((): StructureTerminal | StructureStorage | null => {
      const terminal = objects.activeStructures.terminal
      if (terminal != null && terminal.store.getFreeCapacity() > 10000) {
        return terminal
      }
      const storage = objects.activeStructures.storage
      if (storage != null && storage.store.getFreeCapacity() > 10000) {
        return storage
      }
      return null
    })()

    if (store == null) {
      powerCreep.say("no storage")
    }
    this.runGenerateOps(powerCreep, isMoving, store)
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
      PrimitiveLogger.programError(`${this.identifier} powerCreep.enableRoom() returns ${result} ${roomLink(controller.room.name)}`)
      break
    }
  }

  private hasPower(powerCreep: PowerCreep, power: PowerConstant): boolean {
    return powerCreep.powers[power] != null
  }

  private runRegenSource(powerCreep: PowerCreep, sources: Source[]): boolean {
    if (this.hasPower(powerCreep, PWR_REGEN_SOURCE) !== true) {
      return false
    }
    const regenSource = sources.find(source => {
      if (source.effects == null) {
        return true
      }
      return source.effects.some(effect => effect.effect === PWR_REGEN_SOURCE) !== true
    })
    if (regenSource == null) {
      return false
    }

    const result = powerCreep.usePower(PWR_REGEN_SOURCE, regenSource)

    switch (result) {
    case OK:
    case ERR_TIRED:
      return false

    case ERR_NOT_IN_RANGE:
      powerCreep.moveTo(regenSource, defaultMoveToOptions())
      return true

    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_NOT_OWNER:
    case ERR_BUSY:
    case ERR_INVALID_TARGET:
    case ERR_FULL:
    case ERR_INVALID_ARGS:
    case ERR_NO_BODYPART:
    default:
      PrimitiveLogger.programError(`powerCreep.usePower(PWR_OPERATE_SPAWN) returns ${result} in ${roomLink(this.parentRoomName)}`)
      return false
    }
  }

  private runOperateSpawn(powerCreep: PowerCreep, spawn: StructureSpawn, opsStore: StructureTerminal | StructureStorage | null, isMoving: boolean): boolean {
    if (this.hasPower(powerCreep, PWR_OPERATE_SPAWN) !== true) {
      return false
    }
    const roomInfoMemory = Memory.v6RoomInfo[this.parentRoomName]
    if (roomInfoMemory == null || roomInfoMemory.roomType !== "owned") {
      return false
    }
    if (roomInfoMemory.config?.enableOperateSpawn !== true) {
      return false
    }
    // if ((Game.time % 2000) < 1000) {
    //   return false
    // }

    if (powerCreep.store.getUsedCapacity(RESOURCE_OPS) < 100) {
      if (opsStore != null && powerCreep.withdraw(opsStore, RESOURCE_OPS, 100) === ERR_NOT_IN_RANGE && isMoving !== true) {
        powerCreep.moveTo(opsStore, defaultMoveToOptions())
        return true
      }
      return false
    }

    const result = powerCreep.usePower(PWR_OPERATE_SPAWN, spawn)

    switch (result) {
    case OK:
    case ERR_TIRED:
      return false

    case ERR_NOT_IN_RANGE:
      if (isMoving !== true) {
        powerCreep.moveTo(spawn, defaultMoveToOptions())
        return true
      }
      return false

    case ERR_NOT_ENOUGH_RESOURCES:  // required 100 ops
      return false

    case ERR_NOT_OWNER:
    case ERR_BUSY:
    case ERR_INVALID_TARGET:
    case ERR_FULL:
    case ERR_INVALID_ARGS:
    case ERR_NO_BODYPART:
    default:
      PrimitiveLogger.programError(`powerCreep.usePower(PWR_OPERATE_SPAWN) returns ${result} in ${roomLink(this.parentRoomName)}`)
      return false
    }
  }

  private runGenerateOps(powerCreep: PowerCreep, isMoving: boolean, store: StructureTerminal | StructureStorage | null): void {
    if (this.hasPower(powerCreep, PWR_GENERATE_OPS) !== true) {
      return
    }

    const result = powerCreep.usePower(PWR_GENERATE_OPS)

    switch (result) {
    case OK:
      break

    case ERR_TIRED:
      if (store == null) {
        break
      }
      if (isMoving !== true) {
        if (powerCreep.pos.isNearTo(store) !== true) {
          powerCreep.moveTo(store, defaultMoveToOptions())
        } else {
          powerCreep.move(randomDirection(0))
        }
      }
      if ((powerCreep.store.getUsedCapacity(RESOURCE_OPS) > 300) || (powerCreep.store.getUsedCapacity() > (powerCreep.store.getCapacity() * 0.6))) {
        powerCreep.transfer(store, RESOURCE_OPS, 100)
      }
      break

    case ERR_NOT_IN_RANGE:
    case ERR_NOT_OWNER:
    case ERR_BUSY:
    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_INVALID_TARGET:
    case ERR_FULL:
    case ERR_INVALID_ARGS:
    case ERR_NO_BODYPART:
    default:
      PrimitiveLogger.programError(`powerCreep.usePower(PWR_GENERATE_OPS) returns ${result} in ${roomLink(this.parentRoomName)}`)
      break
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
      PrimitiveLogger.programError(`powerCreep.renew() returns ${result} in ${roomLink(this.parentRoomName)}`)
      break
    }
  }
}
