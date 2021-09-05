import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { managePowerCreepLink } from "utility/log"
import { ProcessState } from "../process_state"
import { processLog } from "os/infrastructure/logger"
import { PowerCreepName } from "prototype/power_creep"
import { MessageObserver } from "os/infrastructure/message_observer"
import { isPowerConstant, PowerConstant, powerName } from "utility/power"

type UpdateInfo = {
  powerCreepName: PowerCreepName
  powerType: PowerConstant
}

export interface UpgradePowerCreepProcessState extends ProcessState {
  readonly reservedUpdates: UpdateInfo[]
}

// Game.powerCreeps["power_creep_0002"].upgrade(PWR_GENERATE_OPS)
// Game.io("launch -l UpgradePowerCreepProcess")
// Game.io("message 1631744000 clear")

/**
 * - message format:
 *   - clear
 *     - clear all reserved updates
 *   - power=<PowerConstant> power_creep_name=<string>
 *     - add update reservation to the end of the stack
 */
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

  public didReceiveMessage(message: string): string {
    if (message === "clear") {
      this.reservedUpdates.splice(0, this.reservedUpdates.length)
      return "Cleared all reserved updates"
    }

    const args = ((): Map<string, string> => {
      const result = new Map<string, string>()
      message.split(" ").forEach(arg => {
        const [key, value] = arg.split("=")
        if (key == null || value == null) {
          return
        }
        result.set(key, value)
      })
      return result
    })()

    const rawPowerType = args.get("power")
    if (rawPowerType == null) {
      return "Missin power argument"
    }
    const powerType = parseInt(rawPowerType, 10)
    if (isNaN(powerType) === true || !isPowerConstant(powerType)) {
      return `Invalid power type ${rawPowerType}`
    }
    const powerCreepName = args.get("power_creep_name")
    if (powerCreepName == null) {
      return "Missin power_creep_name argument"
    }
    this.reservedUpdates.push({
      powerCreepName,
      powerType,
    })
    return `Reserved ${powerName(powerType)} for ${powerCreepName}, index: ${this.reservedUpdates.length - 1}`
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
