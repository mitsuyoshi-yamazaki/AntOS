import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import type { RoomName } from "shared/utility/room_name_types"
import { RoomResources } from "room_resource/room_resources"
import { ProcessDecoder } from "process/process_decoder"
import { ResourceManager } from "utility/resource_manager"
import { Timestamp } from "shared/utility/timestamp"
import { MessageObserver } from "os/infrastructure/message_observer"
import { ListArguments } from "shared/utility/argument_parser/list_argument_parser"
import { processLog } from "os/infrastructure/logger"

ProcessDecoder.register("World39013108CollectResourceProcess", state => {
  return World39013108CollectResourceProcess.decode(state as World39013108CollectResourceProcessState)
})

export interface World39013108CollectResourceProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly resourceType: ResourceConstant
  readonly amount: number
  readonly interval: Timestamp
  readonly lastRunTimestamp: Timestamp
}

export class World39013108CollectResourceProcess implements Process, Procedural, MessageObserver {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly roomName: RoomName,
    private readonly resourceType: ResourceConstant,
    private readonly amount: number,
    private interval: Timestamp,
    private lastRunTimestamp: Timestamp,
  ) {
    this.taskIdentifier = `${this.constructor.name}_${this.resourceType}`
  }

  public encode(): World39013108CollectResourceProcessState {
    return {
      t: "World39013108CollectResourceProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      resourceType: this.resourceType,
      amount: this.amount,
      interval: this.interval,
      lastRunTimestamp: this.lastRunTimestamp,
    }
  }

  public static decode(state: World39013108CollectResourceProcessState): World39013108CollectResourceProcess {
    return new World39013108CollectResourceProcess(state.l, state.i, state.roomName, state.resourceType, state.amount, state.interval, state.lastRunTimestamp ?? 0)
  }

  public static create(processId: ProcessId, roomName: RoomName, resourceType: ResourceConstant, amount: number, interval: number): World39013108CollectResourceProcess {
    const lastRunTimestamp = runNextTickTimestamp(interval)
    return new World39013108CollectResourceProcess(Game.time, processId, roomName, resourceType, amount, interval, lastRunTimestamp)
  }

  public processShortDescription(): string {
    return `collect ${this.amount} ${coloredResourceType(this.resourceType)} to ${roomLink(this.roomName)}, last run: ${this.lastRun()}`
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "run_next_tick", "change_interval"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "run_next_tick":
        this.lastRunTimestamp = runNextTickTimestamp(this.interval)
        return "run next tick"

      case "change_interval": {
        const listArguments = new ListArguments(components)
        const interval = listArguments.int(0, "interval").parse({ min: 1 })
        const oldValue = this.interval
        this.interval = interval
        this.lastRunTimestamp = runNextTickTimestamp(this.interval) // intervalの変更により発火しなくなることの対応
        return `interval set ${interval}, (from ${oldValue})`
      }

      default:
        throw `Invalid command ${commandList}. see "help"`
      }
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }

  private lastRun(): string {
    const lastRun = (Game.time % this.interval) + this.interval - this.lastRunTimestamp
    if (lastRun < 1000) {
      return `${lastRun}ticks ago`
    }
    return `${Math.floor(lastRun / 1000)}k ticks ago`
  }

  public runOnTick(): void {
    if ((Game.time % this.interval) !== this.lastRunTimestamp) {
      return
    }

    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null || roomResource.activeStructures.terminal == null) {
      return
    }

    const terminal = roomResource.activeStructures.terminal
    const resourceAmount = roomResource.getResourceAmount(this.resourceType)
    if (resourceAmount > this.amount) {
      return
    }

    const collectAmount = Math.min(this.amount - resourceAmount, Math.floor(this.amount / 2))
    if ((terminal.store.getFreeCapacity(this.resourceType) - collectAmount) < 10000) {
      return
    }

    const result = ResourceManager.collect(this.resourceType, this.roomName, collectAmount)
    switch (result.resultType) {
    case "succeeded":
      processLog(this, `${result.value} ${coloredResourceType(RESOURCE_POWER)} collected to ${roomLink(this.roomName)}`)
      break
    case "failed":
      processLog(this, `${coloredText("[Warning]", "warn")} collect ${coloredResourceType(RESOURCE_POWER)} failed ${result.reason}`)
      break
    }
  }
}

function runNextTickTimestamp(interval: Timestamp): Timestamp {
  return (Game.time + 1) % interval
}
