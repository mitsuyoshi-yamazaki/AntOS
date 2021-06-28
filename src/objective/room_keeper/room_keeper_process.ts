import { Procedural } from "objective/procedural"
import { Process, ProcessId, processLog, ProcessState } from "objective/process"
import { MessageObserver } from "os/infrastructure/message_observer"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { RoomName } from "prototype/room"
import { roomLink } from "utility/log"
import { RoomKeeperObjective, RoomKeeperObjectiveEvents, RoomKeeperObjectiveState } from "./room_keeper_objective"

export interface RoomKeeperProcessState extends ProcessState {
  /** objective state */
  s: RoomKeeperObjectiveState
}

export class RoomKeeperProcess implements Process, Procedural, MessageObserver {
  public get roomName(): RoomName {
    return this.objective.roomName
  }

  public constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly objective: RoomKeeperObjective,
  ) { }

  public encode(): RoomKeeperProcessState {
    return {
      t: "RoomKeeperProcess",
      l: this.launchTime,
      i: this.processId,
      s: this.objective.encode(),
    }
  }

  public static decode(state: RoomKeeperProcessState): RoomKeeperProcess {
    const objective = RoomKeeperObjective.decode(state.s)
    return new RoomKeeperProcess(state.l, state.i, objective)
  }

  public processShortDescription(): string {
    return roomLink(this.objective.roomName)
  }

  public runOnTick(): void {
    const progress = this.objective.progress()
    switch (progress.objectProgressType) {
    case "in progress":
      this.logEvent(progress.value)
      return
    case "failed":
      PrimitiveLogger.log(`Failed with error: ${progress.reason}`)
      return
    }
  }

  public didReceiveMessage(message: string): string {
    const components = message.split(" ")
    if (components.length < 2) {
      return `Lack of arguments: expecting &ltcommand&gt &lttarget&gt, raw: ${message}`
    }
    if (components[0] !== "claim") {
      return `Invalid command ${components[0]}, available commands: [claim]`
    }
    this.objective.claimRoom(components[1])
    return "ok"
  }

  private logEvent(event: RoomKeeperObjectiveEvents): void {
    let message = `${roomLink(this.objective.roomName)} ${event.status}`
    if (event.spawnedCreeps > 0) {
      message += `, ${event.spawnedCreeps} creeps spawned`
    }
    if (event.canceledCreepNames.length > 0) {
      message += `, ${event.canceledCreepNames.length} creeps canceled`
    }
    processLog(this, message)
  }
}
