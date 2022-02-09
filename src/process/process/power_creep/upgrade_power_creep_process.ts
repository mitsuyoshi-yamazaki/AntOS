import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredText, managePowerCreepLink } from "utility/log"
import { ProcessState } from "../../process_state"
import { processLog } from "os/infrastructure/logger"
import { PowerCreepName } from "prototype/power_creep"
import { MessageObserver } from "os/infrastructure/message_observer"
import { powerName } from "utility/power"
import { ProcessDecoder } from "process/process_decoder"
import { KeywordArguments } from "os/infrastructure/console_command/utility/keyword_argument_parser"

ProcessDecoder.register("UpgradePowerCreepProcess", state => {
  return UpgradePowerCreepProcess.decode(state as UpgradePowerCreepProcessState)
})

type UpdateInfo = {
  powerCreepName: PowerCreepName
  powerType: PowerConstant
}

export interface UpgradePowerCreepProcessState extends ProcessState {
  readonly reservedUpdates: UpdateInfo[]
}

export class UpgradePowerCreepProcess implements Process, Procedural, MessageObserver {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly reservedUpdates: UpdateInfo[],
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): UpgradePowerCreepProcessState {
    return {
      t: "UpgradePowerCreepProcess",
      l: this.launchTime,
      i: this.processId,
      reservedUpdates: this.reservedUpdates,
    }
  }

  public static decode(state: UpgradePowerCreepProcessState): UpgradePowerCreepProcess {
    return new UpgradePowerCreepProcess(state.l, state.i, state.reservedUpdates)
  }

  public static create(processId: ProcessId): UpgradePowerCreepProcess {
    return new UpgradePowerCreepProcess(Game.time, processId, [])
  }

  public processShortDescription(): string {
    const next = this.reservedUpdates[0]
    if (next == null) {
      return "No updates"
    }
    const reservations = this.reservedUpdates.length <= 1 ? "" : ` ${this.reservedUpdates.length - 1} more`
    return `${powerName(next.powerType)}, ${next.powerCreepName}${reservations}`
  }

  public processDescription(): string {
    if (this.reservedUpdates.length <= 0) {
      return "no reserved updates"
    }

    return this.reservedUpdates.map((update, index) => `- ${index}: ${update.powerCreepName} ${powerName(update.powerType)}`).join("\n")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "add", "clear", "show"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "add": {
        const keywordArguments = new KeywordArguments(components)
        const powerType = keywordArguments.powerType("power").parse()
        const powerCreep = keywordArguments.powerCreep("power_creep_name").parse()

        this.reservedUpdates.push({
          powerCreepName: powerCreep.name,
          powerType,
        })
        return `Reserved ${powerName(powerType)} for ${powerCreep.name}, index: ${this.reservedUpdates.length - 1}`
      }

      case "clear": {
        this.reservedUpdates.splice(0, this.reservedUpdates.length)
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
    if ((Game.time % 983) !== 23) {
      return
    }
    const update = this.reservedUpdates[0]
    if (update == null) {
      return
    }
    const powerCreep = Game.powerCreeps[update.powerCreepName]
    if (powerCreep == null) {
      return
    }
    this.update(powerCreep, update.powerType)
  }

  private update(powerCreep: PowerCreep, power: PowerConstant): void {
    const result = powerCreep.upgrade(power)
    switch (result) {
    case OK:
      processLog(this, `PowerCreep ${powerCreep.name} updated ${powerName(power)}, ${managePowerCreepLink()}`)
      this.reservedUpdates.shift()
      break

    case ERR_NOT_ENOUGH_RESOURCES:
      break

    case ERR_FULL:
      processLog(this, `PowerCreep ${powerCreep.name} has max ${powerName(power)} level, ${managePowerCreepLink()}`)
      this.reservedUpdates.shift()
      break

    case ERR_NOT_OWNER:
    case ERR_INVALID_ARGS:
      this.reservedUpdates.shift()
      PrimitiveLogger.programError(`${this.constructor.name} powerCreep.upgrade() returns ${result}, ${powerCreep.name}, ${powerName(power)}`)
    }
  }
}
