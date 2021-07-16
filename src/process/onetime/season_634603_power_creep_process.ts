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
    const powerSpawn = objects.activeStructures.powerSpawn
    let isMoving = false
    if (powerSpawn != null && powerCreep.ticksToLive != null && powerCreep.ticksToLive < 1000) {
      this.renewPowerCreep(powerCreep, powerSpawn)
      isMoving = true
    }

    const spawn = objects.activeStructures.spawns[0]
    if (spawn != null) {
      isMoving = isMoving || this.runOperateSpawn(powerCreep, spawn, isMoving)
    }

    const store = ((): StructureTerminal | StructureStorage | null => {
      const terminal = objects.activeStructures.terminal
      if (terminal != null && terminal.store.getFreeCapacity() > 100000) {
        return terminal
      }
      const storage = objects.activeStructures.storage
      if (storage != null && storage.store.getFreeCapacity() > 100000) {
        return storage
      }
      return null
    })()

    if (store != null) {
      this.runGenerateOps(powerCreep, isMoving, store)
    }
  }

  private runOperateSpawn(powerCreep: PowerCreep, spawn: StructureSpawn, isMoving: boolean): boolean {
    const result = powerCreep.usePower(PWR_OPERATE_SPAWN)

    switch (result) {
    case OK:
    case ERR_TIRED:
      return false

    case ERR_NOT_IN_RANGE:
      if (isMoving !== true) {
        powerCreep.moveTo(spawn, defaultMoveToOptions)
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

  private runGenerateOps(powerCreep: PowerCreep, isMoving: boolean, store: StructureTerminal | StructureStorage): void {
    const result = powerCreep.usePower(PWR_GENERATE_OPS)

    switch (result) {
    case OK:
      break

    case ERR_TIRED:
      if (powerCreep.transfer(store, RESOURCE_OPS) === ERR_NOT_IN_RANGE && isMoving !== true) {
        powerCreep.moveTo(store, defaultMoveToOptions)
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
      powerCreep.moveTo(powerSpawn, defaultMoveToOptions)
      break

    case ERR_NOT_OWNER:
    case ERR_BUSY:
    case ERR_INVALID_TARGET:
      PrimitiveLogger.programError(`powerCreep.renew() returns ${result} in ${roomLink(this.parentRoomName)}`)
      break
    }
  }
}
