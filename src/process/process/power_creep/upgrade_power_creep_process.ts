import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredText, managePowerCreepLink, roomLink } from "utility/log"
import { ProcessState } from "../../process_state"
import { processLog } from "os/infrastructure/logger"
import { PowerCreepName } from "prototype/power_creep"
import { MessageObserver } from "os/infrastructure/message_observer"
import { powerName } from "utility/power"
import { ProcessDecoder } from "process/process_decoder"
import { KeywordArguments } from "os/infrastructure/console_command/utility/keyword_argument_parser"
import { RoomName } from "utility/room_name"
import { OperatingSystem } from "os/os"
import { PowerCreepProcess } from "./power_creep_process"

ProcessDecoder.register("UpgradePowerCreepProcess", state => {
  return UpgradePowerCreepProcess.decode(state as UpgradePowerCreepProcessState)
})

type CreatePowerCreepState = "queued" | "created" | "upgraded" | "spawned"

/**
 * - GPLを2消費する
 *   - (1 GPL) PowerCreepの生成
 *   - (1 GPL) PowerCreepのUpgrade
 *     - PowerCreepのSpawn
 *     - PowerCreepProcessの起動
 */
type CreatePowerCreep = {
  case: "create"
  powerCreepName: PowerCreepName
  firstPowerType: PowerConstant
  powerSpawnId: Id<StructurePowerSpawn>
  roomName: RoomName
  state: CreatePowerCreepState
}
type UpgradePowerCreep = {
  case: "upgrade"
  powerCreepName: PowerCreepName
  powerType: PowerConstant
}
type Upgrade = CreatePowerCreep | UpgradePowerCreep

export interface UpgradePowerCreepProcessState extends ProcessState {
  readonly reservedUpgrades: Upgrade[]
  readonly runNextTick: boolean
}

export class UpgradePowerCreepProcess implements Process, Procedural, MessageObserver {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly reservedUpgrades: Upgrade[],
    private runNextTick: boolean,
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): UpgradePowerCreepProcessState {
    return {
      t: "UpgradePowerCreepProcess",
      l: this.launchTime,
      i: this.processId,
      reservedUpgrades: this.reservedUpgrades,
      runNextTick: this.runNextTick,
    }
  }

  public static decode(state: UpgradePowerCreepProcessState): UpgradePowerCreepProcess {
    const runNextTick = state.runNextTick ?? false  // FixMe: Migration
    return new UpgradePowerCreepProcess(state.l, state.i, state.reservedUpgrades, runNextTick)
  }

  public static create(processId: ProcessId): UpgradePowerCreepProcess {
    return new UpgradePowerCreepProcess(Game.time, processId, [], false)
  }

  public processShortDescription(): string {
    const next = this.reservedUpgrades[0]
    if (next == null) {
      return "No updates"
    }
    const reservations = this.reservedUpgrades.length <= 1 ? "" : ` ${this.reservedUpgrades.length - 1} more`
    return `${upgradeShortDescription(next)}, ${next.powerCreepName}${reservations}`
  }

  public processDescription(): string {
    if (this.reservedUpgrades.length <= 0) {
      return "no reserved updates"
    }

    return this.reservedUpgrades.map((upgrade, index) => `- ${index}: ${upgradeDescription(upgrade)}`).join("\n")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "upgrade", "create", "clear", "show"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "upgrade": {
        const keywordArguments = new KeywordArguments(components)
        const powerType = keywordArguments.powerType("power").parse()
        const powerCreepName = keywordArguments.string("power_creep_name").parse()
        const powerCreep = Game.powerCreeps[powerCreepName]
        if (powerCreep == null) {
          const isReserved = this.reservedUpgrades.some(upgrade => {
            switch (upgrade.case) {
            case "create":
              if (upgrade.powerCreepName === powerCreepName) {
                return true
              }
              return false
            case "upgrade":
              return false
            }
          })
          if (isReserved !== true) {
            throw `no power creep with name ${powerCreepName}`
          }
        }

        const upgrade: UpgradePowerCreep = {
          case: "upgrade",
          powerCreepName,
          powerType,
        }

        const unshift = keywordArguments.boolean("unshift").parseOptional() ?? false
        if (unshift === true) {
          this.reservedUpgrades.unshift(upgrade)
        } else {
          this.reservedUpgrades.push(upgrade)
        }
        const index = unshift === true ? 0 : this.reservedUpgrades.length - 1

        return `Reserved ${powerName(powerType)} for ${powerCreepName}, index: ${index}`
      }

      case "create": {
        const keywordArguments = new KeywordArguments(components)
        const powerCreepName = keywordArguments.string("power_creep_name").parse()
        if (Game.powerCreeps[powerCreepName] != null) {
          throw `Duplicated power_creep_name ${powerCreepName}`
        }
        const firstPowerType = keywordArguments.powerType("first_power").parse()
        const spawnRoomResource = keywordArguments.ownedRoomResource("spawn_room_name").parse()
        const powerSpawn = spawnRoomResource.activeStructures.powerSpawn
        if (powerSpawn == null) {
          throw `${roomLink(spawnRoomResource.room.name)} doesn't have active power spawn`
        }
        this.reservedUpgrades.push({
          case: "create",
          powerCreepName: powerCreepName,
          firstPowerType,
          powerSpawnId: powerSpawn.id,
          roomName: powerSpawn.room.name,
          state: "queued",
        })
        return `Reserved create ${powerCreepName} in ${roomLink(spawnRoomResource.room.name)}, index: ${this.reservedUpgrades.length - 1}`
      }

      case "clear": {
        this.reservedUpgrades.splice(0, this.reservedUpgrades.length)
        return "cleared all reserved updates"
      }

      case "show":
        return this.processDescription()

      default:
        throw `Invalid command ${command}, see "help"`
      }
    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  }

  public runOnTick(): void {
    if (this.runNextTick !== true && (Game.time % 97) !== 11) {
      return
    }
    this.runNextTick = false

    const upgrade = this.reservedUpgrades[0]
    if (upgrade == null) {
      return
    }

    switch (upgrade.case) {
    case "create": {
      const { executed } = this.runCreatePowerCreep(upgrade)
      if (executed === true) {
        this.reservedUpgrades.shift()
      }
      break
    }

    case "upgrade": {
      const powerCreep = Game.powerCreeps[upgrade.powerCreepName]
      if (powerCreep == null) {
        this.reservedUpgrades.shift()
        break
      }
      switch (this.upgrade(powerCreep, upgrade.powerType)) {
      case "succeeded":
        this.reservedUpgrades.shift()
        break

      case "gpl not enough":
        break

      case "failed":
        this.reservedUpgrades.shift()
        break
      }
    }
    }
  }

  private runCreatePowerCreep(create: CreatePowerCreep): { executed: boolean } {
    switch (create.state) {
    case "queued": {
      return (() => {
        switch (this.createPowerCreep(create.powerCreepName)) {
        case "succeeded":
          create.state = "created"
          return { executed: false }

        case "failed":
          return { executed: true }

        case "gpl not enough":
          return { executed: false }
        }
      })()
    }
    case "created": {
      return (() => {
        const powerCreep = Game.powerCreeps[create.powerCreepName]
        if (powerCreep == null) {
          return { executed: true }
        }
        switch (this.upgrade(powerCreep, create.firstPowerType)) {
        case "succeeded":
          create.state = "upgraded"
          this.runNextTick = true
          return { executed: false }

        case "gpl not enough":
          return { executed: false }

        case "failed":
          return { executed: true }
        }
      })()
    }

    case "upgraded": {
      const powerCreep = Game.powerCreeps[create.powerCreepName]
      if (powerCreep == null) {
        return { executed: true }
      }

      const powerSpawn = Game.getObjectById(create.powerSpawnId)
      if (powerSpawn == null) {
        return { executed: true }
      }
      this.spawnPowerCreep(powerCreep, powerSpawn)
      create.state = "spawned"
      this.runNextTick = true
      return { executed: false }
    }

    case "spawned": {
      const powerCreep = Game.powerCreeps[create.powerCreepName]
      if (powerCreep == null || powerCreep.room == null) {
        return { executed: true }
      }
      this.launchPowerCreepProces(powerCreep.name, powerCreep.room.name)
      return { executed: true }
    }
    }
  }

  private createPowerCreep(name: PowerCreepName): "succeeded" | "failed" | "gpl not enough" {
    const result = PowerCreep.create(name, POWER_CLASS.OPERATOR)
    switch (result as number) { // ERR_INVALID_ARGSが入っていないため
    case OK:
      processLog(this, `PowerCreep ${name} is created`)
      return "succeeded"

    case ERR_NOT_ENOUGH_RESOURCES:
      return "gpl not enough"

    case ERR_NAME_EXISTS:
    case ERR_INVALID_ARGS:
    default:
      PrimitiveLogger.programError(`${this.constructor.name} PowerCreep.create() returns ${result}, name: ${name}`)
      return "failed"
    }
  }

  private spawnPowerCreep(powerCreep: PowerCreep, powerSpawn: StructurePowerSpawn): void {
    const result = powerCreep.spawn(powerSpawn)
    switch (result) {
    case OK:
      processLog(this, `PowerCreep ${powerCreep.name} is spawned in ${roomLink(powerSpawn.room.name)}`)
      return

    case ERR_NOT_OWNER:
    case ERR_BUSY:
    case ERR_INVALID_TARGET:
    case ERR_TIRED:
    case ERR_RCL_NOT_ENOUGH:
      PrimitiveLogger.programError(`${this.constructor.name} PowerCreep.spawn() returns ${result}, name: ${powerCreep.name}`)
      return
    }
  }

  private launchPowerCreepProces(powerCreepName: PowerCreepName, roomName: RoomName): void {
    const alreadyLaunched = ((): boolean => {
      return OperatingSystem.os.listAllProcesses().some(processInfo => {
        const process = processInfo.process
        if (!(process instanceof PowerCreepProcess)) {
          return false
        }
        if (process.powerCreepName !== powerCreepName) {
          return false
        }
        return true
      })
    })()

    if (alreadyLaunched) {
      PrimitiveLogger.programError(`${this.constructor.name} ${this.processId} PowerCreepProcess for ${powerCreepName} is already launched`)
      return
    }
    OperatingSystem.os.addProcess(null, processId => {
      return PowerCreepProcess.create(processId, roomName, powerCreepName)
    })
  }

  private upgrade(powerCreep: PowerCreep, power: PowerConstant): "succeeded" | "failed" | "gpl not enough" {
    const result = powerCreep.upgrade(power)
    switch (result) {
    case OK:
      processLog(this, `PowerCreep ${powerCreep.name} upgraded ${powerName(power)}, ${managePowerCreepLink()}`)
      return "succeeded"

    case ERR_NOT_ENOUGH_RESOURCES:
      return "gpl not enough" // PowerCreepのレベルが不足している場合もここに入る

    case ERR_FULL:
      processLog(this, `PowerCreep ${powerCreep.name} has max ${powerName(power)} level, ${managePowerCreepLink()}`)
      return "failed"

    case ERR_NOT_OWNER:
    case ERR_INVALID_ARGS:
      PrimitiveLogger.programError(`${this.constructor.name} powerCreep.upgrade() returns ${result}, ${powerCreep.name}, ${powerName(power)}`)
      return "failed"
    }
  }
}

function upgradeShortDescription(upgrade: Upgrade): string {
  switch (upgrade.case) {
  case "create":
    return `create PowerCreep in ${roomLink(upgrade.roomName)}`
  case "upgrade":
    return `${powerName(upgrade.powerType)}(${upgrade.powerType})`
  }
}

function upgradeDescription(upgrade: Upgrade): string {
  return `${upgrade.powerCreepName} ${upgradeShortDescription(upgrade)}`
}
