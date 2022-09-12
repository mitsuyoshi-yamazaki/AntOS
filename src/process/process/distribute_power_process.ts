import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { processLog } from "os/infrastructure/logger"
import type { Timestamp } from "shared/utility/timestamp"
import { RoomResources } from "room_resource/room_resources"
import { ProcessDecoder } from "process/process_decoder"
import { shortenedNumber } from "shared/utility/console_utility"
import { RoomName } from "shared/utility/room_name_types"
import { PowerProcessProcess } from "./power_creep/power_process_process"
import { SystemCalls } from "os/system_calls"
import { ResourceManager } from "utility/resource_manager"

ProcessDecoder.register("DistributePowerProcess", state => {
  return DistributePowerProcess.decode(state as DistributePowerProcessState)
})

export interface DistributePowerProcessState extends ProcessState {
  readonly lastRun: Timestamp
  readonly interval: Timestamp
}

export class DistributePowerProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly lastRun: Timestamp,
    private readonly interval: Timestamp,
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): DistributePowerProcessState {
    return {
      t: "DistributePowerProcess",
      l: this.launchTime,
      i: this.processId,
      lastRun: this.lastRun,
      interval: this.interval,
    }
  }

  public static decode(state: DistributePowerProcessState): DistributePowerProcess {
    return new DistributePowerProcess(state.l, state.i, state.lastRun, state.interval)
  }

  public static create(processId: ProcessId, interval: number): DistributePowerProcess {
    return new DistributePowerProcess(Game.time, processId, Game.time - interval, interval)
  }

  public processShortDescription(): string {
    return `interval: ${this.interval}, last run: ${shortenedNumber(Game.time - this.lastRun)}ticks ago`
  }

  public runOnTick(): void {
    if (Game.time < (this.lastRun + this.interval)) {
      return
    }

    const powerProcessingRoomNames: RoomName[] = []
    const requirePowerRoomNames: RoomName[] = []
    const sendPowerMaxAmount = 5000

    const results: string[] = [
      "", // processLog() 表示時に改行するため
    ]

    results.push("Power processing rooms:");

    (SystemCalls.systemCall()?.listAllProcesses() ?? []).forEach(processInfo => {
      if (!(processInfo.process instanceof PowerProcessProcess)) {
        return
      }
      const addResult = (result: string): void => {
        results.push(`- ${roomLink(roomName)} ${result}`)
      }

      const roomName = processInfo.process.parentRoomName
      powerProcessingRoomNames.push(roomName)
      if (processInfo.running !== true) {
        addResult("not running")
        return
      }
      const roomResource = RoomResources.getOwnedRoomResource(roomName)
      if (roomResource == null) {
        addResult("no room resource")
        return
      }
      const powerAmount = roomResource.getResourceAmount(RESOURCE_POWER)
      if (powerAmount > sendPowerMaxAmount) {
        addResult(`sufficient power (${powerAmount})`)
        return
      }
      const terminal = roomResource.activeStructures.terminal
      if (terminal == null) {
        addResult("no terminal")
        return
      }
      const freeCapacity = terminal.store.getFreeCapacity()
      if (freeCapacity < 10000) {
        addResult(`lack of free capacity (${freeCapacity})`)
        return
      }
      requirePowerRoomNames.push(roomName)
      addResult("running")
    })

    results.push("Power storing rooms:")
    Array.from(ResourceManager.resourceInRoom(RESOURCE_POWER).entries())
      .forEach(([roomName, amount]) => {
        if (powerProcessingRoomNames.includes(roomName) === true && amount < (sendPowerMaxAmount * 3)) {
          return
        }

        const addResult = (result: string): void => {
          results.push(`- ${roomLink(roomName)} ${result}`)
        }

        const roomResource = RoomResources.getOwnedRoomResource(roomName)
        if (roomResource == null) {
          addResult("no room resource")
          return
        }
        const terminal = roomResource.activeStructures.terminal
        if (terminal == null) {
          addResult("no terminal")
          return
        }
        if (terminal.cooldown > 0) {
          addResult(`terminal under cooldown ${terminal.cooldown}`)
          return
        }
        const sendAmount = Math.min(amount, sendPowerMaxAmount)
        if (sendAmount <= 0) {
          addResult("no power")
          return
        }
        const energyAmount = roomResource.getResourceAmount(RESOURCE_ENERGY)
        if (energyAmount < 50000) {
          addResult(`no energy (${energyAmount})`)
          return
        }
        const destination = requirePowerRoomNames.pop()
        if (destination == null) {
          addResult("no destination")
          return
        }
        addResult(send(terminal, destination, sendAmount))
      })

    processLog(this, results.join("\n"))
  }
}

function send(terminal: StructureTerminal, destination: RoomName, amount: number): string {
  const result = terminal.send(RESOURCE_POWER, amount, destination)
  switch (result) {
  case OK:
    return `sent ${amount} =&gt ${roomLink(destination)}`
  case ERR_NOT_OWNER:
  case ERR_NOT_ENOUGH_RESOURCES:
  case ERR_INVALID_ARGS:
  case ERR_TIRED:
  default:
    return `failed to sent ${amount} =&gt ${roomLink(destination)} (${result})`
  }
}
