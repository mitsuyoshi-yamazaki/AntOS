import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
import { coloredText, roomLink } from "utility/log"
import { World } from "world_info/world_info"
import { ProcessState } from "process/process_state"
import { DeployedPowerCreep, isDeployedPowerCreep, PowerCreepName } from "prototype/power_creep"
import { defaultMoveToOptions } from "prototype/creep"
import { processLog } from "os/infrastructure/logger"
import { PowerCreepProcess } from "./power_creep_process"
import { OperatingSystem } from "os/os"
import { moveToRoom } from "script/move_to_room"
import { ProcessDecoder } from "process/process_decoder"
import { RoomResources } from "room_resource/room_resources"

ProcessDecoder.register("MovePowerCreepProcess", state => {
  return MovePowerCreepProcess.decode(state as MovePowerCreepProcessState)
})

export interface MovePowerCreepProcessState extends ProcessState {
  fromRoomName: RoomName
  toRoomName: RoomName
  waypoints: RoomName[]
  powerCreepName: PowerCreepName
  renewed: boolean
  currentRoomName: RoomName
}

export class MovePowerCreepProcess implements Process, Procedural {
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly identifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly fromRoomName: RoomName,
    public readonly toRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private readonly powerCreepName: PowerCreepName,
    private renewed: boolean,
    private currentRoomName: RoomName,
  ) {
    this.identifier = `${this.constructor.name}_${this.fromRoomName}_${this.toRoomName}_${this.powerCreepName}`
  }

  public encode(): MovePowerCreepProcessState {
    return {
      t: "MovePowerCreepProcess",
      l: this.launchTime,
      i: this.processId,
      fromRoomName: this.fromRoomName,
      toRoomName: this.toRoomName,
      waypoints: this.waypoints,
      powerCreepName: this.powerCreepName,
      renewed: this.renewed,
      currentRoomName: this.currentRoomName,
    }
  }

  public static decode(state: MovePowerCreepProcessState): MovePowerCreepProcess | null {
    return new MovePowerCreepProcess(state.l, state.i, state.fromRoomName, state.toRoomName, state.waypoints, state.powerCreepName, state.renewed, state.currentRoomName)
  }

  public static create(processId: ProcessId, fromRoomName: RoomName, toRoomName: RoomName, waypoints: RoomName[], powerCreepName: PowerCreepName): MovePowerCreepProcess {
    return new MovePowerCreepProcess(Game.time, processId, fromRoomName, toRoomName, waypoints, powerCreepName, false, fromRoomName)
  }

  public processShortDescription(): string {
    return `${roomLink(this.fromRoomName)} to ${roomLink(this.toRoomName)} ${this.powerCreepName} in ${roomLink(this.currentRoomName)}`
  }

  public runOnTick(): void {
    const powerCreep = Game.powerCreeps[this.powerCreepName]
    if (powerCreep == null) {
      PrimitiveLogger.programError(`Power creep ${this.powerCreepName} is deleted`)
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }
    if (!isDeployedPowerCreep(powerCreep)) {
      PrimitiveLogger.fatal(`Power creep ${this.powerCreepName} lost in ${roomLink(this.currentRoomName)}`)
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }
    if (powerCreep.room.name !== this.currentRoomName) {
      processLog(this, `Power creep ${this.powerCreepName} in ${roomLink(powerCreep.room.name)}`)
      this.currentRoomName = powerCreep.room.name
    }
    this.runPowerCreep(powerCreep)
  }

  private runPowerCreep(powerCreep: DeployedPowerCreep): void {
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

    // if (powerCreep.room.roomType !== "source_keeper") {
    //   const hostileAttacker = powerCreep.pos.findClosestByRange(powerCreep.pos.findInRange(FIND_HOSTILE_CREEPS, 6).filter(creep => (creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0)))
    //   if (hostileAttacker != null) {
    //     this.fleeFrom(hostileAttacker.pos, powerCreep, 7)
    //     return
    //   }
    // }
    this.moveToRoom(powerCreep)
  }

  private moveToRoom(powerCreep: DeployedPowerCreep): void {
    const roomResource = RoomResources.getNormalRoomResource(powerCreep.room.name)
    if (roomResource == null) {
      if (this.flee(powerCreep, powerCreep.room.find(FIND_HOSTILE_CREEPS).filter(creep => Game.isEnemy(creep.owner) === true)) === true) {
        return
      }
    } else if (roomResource.hostiles.creeps.length > 0) {
      if (this.flee(powerCreep, roomResource.hostiles.creeps) === true) {
        return
      }
    }
    moveToRoom(powerCreep, this.toRoomName, this.waypoints)
  }

  private flee(powerCreep: DeployedPowerCreep, hostileCreeps: Creep[]): boolean {
    const hostileAttackers = hostileCreeps.filter(creep => {
      if (creep.getActiveBodyparts(ATTACK) > 0) {
        return true
      }
      if (creep.getActiveBodyparts(RANGED_ATTACK) > 0) {
        return true
      }
      return false
    })
    const closestHostileCreep = powerCreep.pos.findClosestByRange(hostileAttackers)
    if (closestHostileCreep == null) {
      return false
    }
    if (closestHostileCreep.pos.getRangeTo(powerCreep.pos) > 5) {
      return false
    }

    this.fleeFrom(closestHostileCreep.pos, powerCreep, 7)
    return true
  }

  private runGenerateOps(powerCreep: DeployedPowerCreep): void {
    const result = powerCreep.usePower(PWR_GENERATE_OPS)
    switch (result) {
    case OK:
      return

    case ERR_TIRED:
      return

    case ERR_INVALID_ARGS:
      return  // 通過中の部屋はPowerが有効化されていない場合がある

    case ERR_NOT_IN_RANGE:
    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_NOT_OWNER:
    case ERR_BUSY:
    case ERR_INVALID_TARGET:
    case ERR_FULL:
    case ERR_NO_BODYPART:
    default:
      PrimitiveLogger.fatal(`${this.identifier} powerCreep.usePower(PWR_GENERATE_OPS) failed ${result}`)
      return
    }
  }

  private renewPowerCreep(powerCreep: DeployedPowerCreep, powerSpawn: StructurePowerSpawn): void {
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

    OperatingSystem.os.addProcess(null, (processId => PowerCreepProcess.create(processId, this.toRoomName, this.powerCreepName)))
  }

  private fleeFrom(position: RoomPosition, creep: AnyCreep, range: number): void {
    const path = PathFinder.search(creep.pos, { pos: position, range }, {
      flee: true,
      maxRooms: 2,
    })
    creep.moveByPath(path.path)
  }
}
