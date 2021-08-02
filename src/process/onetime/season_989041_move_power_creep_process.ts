import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { coloredText, roomLink } from "utility/log"
import { World } from "world_info/world_info"
import { ProcessState } from "process/process_state"
import { PowerCreepName } from "prototype/power_creep"
import { defaultMoveToOptions } from "prototype/creep"
import { processLog } from "process/process_log"
import { Season634603PowerCreepProcess } from "./season_634603_power_creep_process"
import { OperatingSystem } from "os/os"
import { moveToRoom } from "script/move_to_room"

export interface Season989041MovePowerCreepProcessState extends ProcessState {
  fromRoomName: RoomName
  toRoomName: RoomName
  waypoints: RoomName[]
  powerCreepName: PowerCreepName
  renewed: boolean
}

// Game.io("launch -l Season989041MovePowerCreepProcess from_room_name=W24S29 to_room_name=W14S28 waypoints=W24S30,W14S30 power_creep_name=power_creep_0000")
// Game.io("launch -l Season989041MovePowerCreepProcess from_room_name=W9S24 to_room_name=W14S28 waypoints=W10S24,W10S30,W14S30 power_creep_name=power_creep_0001")
// Game.io("launch -l Season989041MovePowerCreepProcess from_room_name=W14S28 to_room_name=W9S24 waypoints=W14S30,W10S30,W10S24 power_creep_name=power_creep_0000")
// Game.io("launch -l Season989041MovePowerCreepProcess from_room_name=W9S24 to_room_name=W3S24 waypoints=W9S25,W3S25 power_creep_name=power_creep_0000")
export class Season989041MovePowerCreepProcess implements Process, Procedural {
  private readonly identifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly fromRoomName: RoomName,
    public readonly toRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private readonly powerCreepName: PowerCreepName,
    private renewed: boolean,
  ) {
    this.identifier = `${this.constructor.name}_${this.fromRoomName}_${this.toRoomName}_${this.powerCreepName}`
  }

  public encode(): Season989041MovePowerCreepProcessState {
    return {
      t: "Season989041MovePowerCreepProcess",
      l: this.launchTime,
      i: this.processId,
      fromRoomName: this.fromRoomName,
      toRoomName: this.toRoomName,
      waypoints: this.waypoints,
      powerCreepName: this.powerCreepName,
      renewed: this.renewed,
    }
  }

  public static decode(state: Season989041MovePowerCreepProcessState): Season989041MovePowerCreepProcess | null {
    return new Season989041MovePowerCreepProcess(state.l, state.i, state.fromRoomName, state.toRoomName, state.waypoints, state.powerCreepName, state.renewed)
  }

  public static create(processId: ProcessId, fromRoomName: RoomName, toRoomName: RoomName, waypoints: RoomName[], powerCreepName: PowerCreepName): Season989041MovePowerCreepProcess {
    return new Season989041MovePowerCreepProcess(Game.time, processId, fromRoomName, toRoomName, waypoints, powerCreepName, false)
  }

  public processShortDescription(): string {
    return `${roomLink(this.fromRoomName)} to ${roomLink(this.toRoomName)} ${this.powerCreepName}`
  }

  public runOnTick(): void {
    const powerCreep = Game.powerCreeps[this.powerCreepName]
    if (powerCreep == null) {
      PrimitiveLogger.fatal(`Power creep ${this.powerCreepName} lost between ${roomLink(this.fromRoomName)} and ${roomLink(this.toRoomName)}`)
      return
    }
    this.runPowerCreep(powerCreep)
  }

  private runPowerCreep(powerCreep: PowerCreep): void {
    if (powerCreep.room == null) {
      PrimitiveLogger.fatal(`${this.constructor.name} Power creep ${this.powerCreepName} is not deployed`)
      return
    }

    this.runGenerateOps(powerCreep)

    if (this.renewed !== true) {
      const objects = World.rooms.getOwnedRoomObjects(this.fromRoomName)
      if (objects == null) {
        PrimitiveLogger.fatal(`${this.constructor.name} ${roomLink(this.fromRoomName)} lost`)
        return
      }
      if (objects.activeStructures.powerSpawn == null) {
        PrimitiveLogger.fatal(`${this.constructor.name} No power spawn in ${roomLink(this.fromRoomName)}`)
        return
      }
      this.renewPowerCreep(powerCreep, objects.activeStructures.powerSpawn)
      return
    }

    if (powerCreep.room.name === this.toRoomName) {
      this.launchPowerCreepProcess()
      OperatingSystem.os.killProcess(this.processId)
      return
    }

    if (powerCreep.room.roomType !== "source_keeper") {
      const hostileAttacker = powerCreep.pos.findClosestByRange(powerCreep.pos.findInRange(FIND_HOSTILE_CREEPS, 6).filter(creep => (creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0)))
      if (hostileAttacker != null) {
        this.fleeFrom(hostileAttacker.pos, powerCreep, 7)
        return
      }
    }
    this.moveToRoom(powerCreep)
  }

  private moveToRoom(powerCreep: PowerCreep): void {
    moveToRoom(powerCreep, this.toRoomName, this.waypoints)
  }

  private runGenerateOps(powerCreep: PowerCreep): void {
    powerCreep.usePower(PWR_GENERATE_OPS)
  }

  private renewPowerCreep(powerCreep: PowerCreep, powerSpawn: StructurePowerSpawn): void {
    const result = powerCreep.renew(powerSpawn)
    switch (result) {
    case OK:
      processLog(this, `${coloredText("[Renew]", "info")} Power creep ${this.powerCreepName} renewed in ${roomLink(this.fromRoomName)}`)
      this.renewed = true
      break

    case ERR_NOT_IN_RANGE:
      powerCreep.moveTo(powerSpawn, defaultMoveToOptions())
      break

    case ERR_NOT_OWNER:
    case ERR_BUSY:
    case ERR_INVALID_TARGET:
      PrimitiveLogger.programError(`powerCreep.renew() returns ${result} in ${roomLink(this.fromRoomName)}`)
      break
    }
  }

  private launchPowerCreepProcess(): void {
    processLog(this, `${coloredText("[Arrived]", "info")} Power creep ${this.powerCreepName} arrived in ${roomLink(this.toRoomName)}`)

    const process = OperatingSystem.os.addProcess(processId => Season634603PowerCreepProcess.create(processId, this.toRoomName, this.powerCreepName))
    const logger = OperatingSystem.os.getLoggerProcess()
    if (logger == null) {
      return
    }
    logger.didReceiveMessage(`add id ${process.processId}`)
  }

  private fleeFrom(position: RoomPosition, creep: AnyCreep, range: number): void {
    const path = PathFinder.search(creep.pos, { pos: position, range }, {
      flee: true,
      maxRooms: 2,
    })
    creep.moveByPath(path.path)
  }
}
