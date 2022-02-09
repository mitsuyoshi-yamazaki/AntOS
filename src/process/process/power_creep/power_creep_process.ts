import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { PowerCreepName } from "prototype/power_creep"
import { defaultMoveToOptions } from "prototype/creep"
import { randomDirection } from "utility/constants"
import { OperatingSystem } from "os/os"
import { moveToRoom } from "script/move_to_room"
import { ProcessDecoder } from "process/process_decoder"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { RoomResources } from "room_resource/room_resources"

ProcessDecoder.register("PowerCreepProcess", state => {
  return PowerCreepProcess.decode(state as PowerCreepProcessState)
})

export interface PowerCreepProcessState extends ProcessState {
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
Game.io("launch -l PowerCreepProcess room_name=W9S24 power_creep_name=power_creep_0002")
*/
export class PowerCreepProcess implements Process, Procedural {
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly identifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    private readonly powerCreepName: PowerCreepName,
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
    }
  }

  public static decode(state: PowerCreepProcessState): PowerCreepProcess | null {
    return new PowerCreepProcess(state.l, state.i, state.r, state.p)
  }

  public static create(processId: ProcessId, roomName: RoomName, powerCreepName: PowerCreepName): PowerCreepProcess {
    return new PowerCreepProcess(Game.time, processId, roomName, powerCreepName)
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
    const roomResource = RoomResources.getOwnedRoomResource(this.parentRoomName)
    if (roomResource == null) {
      return
    }

    this.runPowerCreep(powerCreep, roomResource)
  }

  private runPowerCreep(powerCreep: PowerCreep, roomResource: OwnedRoomResource): void {
    if (powerCreep.room == null) {
      PrimitiveLogger.fatal(`Power creep ${this.powerCreepName} lost ${roomLink(this.parentRoomName)}`)
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }
    if (powerCreep.room.name !== this.parentRoomName) {
      moveToRoom(powerCreep, this.parentRoomName, [])
      this.runGenerateOps(powerCreep)
      return
    }

    if (roomResource.controller.isPowerEnabled !== true) {
      powerCreep.say("enable pwr")
      this.enablePower(powerCreep, roomResource.controller)
      return
    }

    // if (this.hasPower(powerCreep, PWR_OPERATE_TOWER) === true) {
    //   let hostileHealerMaxPower = 0
    //   let healerPowerSum = 0
    //   objects.hostiles.creeps.forEach(hostileCreep => {
    //     const healPower = CreepBody.power(hostileCreep.body, "heal")
    //     if (healPower > hostileHealerMaxPower) {
    //       hostileHealerMaxPower = healPower
    //     }
    //     healerPowerSum += healPower
    //   })
    //   if (hostileHealerMaxPower >= 300 || healerPowerSum >= 600) {
    // Operate Tower
    //   }
    // }

    const powerSpawn = roomResource.activeStructures.powerSpawn
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
      isMoving = this.runRegenSource(powerCreep, roomResource.sources)
    }

    const spawn = roomResource.activeStructures.spawns[0]
    if (spawn != null && (spawn.effects == null || spawn.effects.length <= 0)) {
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

      isMoving = isMoving || this.runOperateSpawn(powerCreep, spawn, opsStore, isMoving)  // isMovingがtrueであれば右辺が実行されないのでは？
    }

    const store = ((): StructureTerminal | StructureStorage | null => {
      const terminal = roomResource.activeStructures.terminal
      if (terminal != null && terminal.store.getFreeCapacity() > 10000) {
        return terminal
      }
      const storage = roomResource.activeStructures.storage
      if (storage != null && storage.store.getFreeCapacity() > 10000) {
        return storage
      }
      return null
    })()

    if (store == null) {
      powerCreep.say("no storage")
    }
    this.runGenerateOps(powerCreep)

    if (isMoving !== true) {
      const storage = roomResource.activeStructures.terminal || roomResource.activeStructures.storage
      if (storage != null) {
        if ((powerCreep.store.getUsedCapacity(RESOURCE_OPS) > 100) || (powerCreep.store.getUsedCapacity() > (powerCreep.store.getCapacity() * 0.6))) {
          this.transferOps(powerCreep, storage)
          return
        }
      }

      this.moveToWaitingPosition(powerCreep, roomResource)
      return
    }
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

  private runGenerateOps(powerCreep: PowerCreep): void {
    if (this.hasPower(powerCreep, PWR_GENERATE_OPS) !== true) {
      return
    }

    const result = powerCreep.usePower(PWR_GENERATE_OPS)

    switch (result) {
    case OK:
    case ERR_TIRED:
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

  private transferOps(powerCreep: PowerCreep, opsStore: StructureTerminal | StructureStorage): void {
    if (powerCreep.pos.isNearTo(opsStore) !== true) {
      powerCreep.moveTo(opsStore, defaultMoveToOptions())
      return
    }
    powerCreep.transfer(opsStore, RESOURCE_OPS, 100)
  }

  private moveToWaitingPosition(powerCreep: PowerCreep, roomResource: OwnedRoomResource): void {
    const waitingPosition = roomResource.roomInfoAccessor.config.getGenericWaitingPosition()
    if (waitingPosition == null) {
      powerCreep.move(randomDirection(0))
      return
    }
    powerCreep.moveTo(waitingPosition, defaultMoveToOptions())
  }
}
