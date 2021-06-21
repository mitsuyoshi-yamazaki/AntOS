import { MessageObserver } from "os/infrastructure/messenger"
import {
  Procedural,
  ProcessId,
  StatefulProcess,
} from "../process"

interface LaunchRoomProcessMemory {
  r: string   // target room name
  w: string[] // worker creep IDs
  c: string | null   // claimer creep ID
}

export class LaunchRoomProcess implements StatefulProcess, Procedural, MessageObserver {
  public readonly shouldStore = true

  private claimerId: string | null = null
  private workerIds: string[] = []

  public constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly roomName: string,
  ) {
  }

  // ---- StatefulProcess ---- //
  public static parseState(rawState: unknown): LaunchRoomProcessMemory | null {
    const state = rawState as LaunchRoomProcessMemory
    if (typeof state.r !== "string") {
      return null
    }
    return state
  }

  public encode(): LaunchRoomProcessMemory {
    return {
      r: this.roomName,
      w: this.workerIds,
      c: this.claimerId,
    }
  }

  // ---- Procedural ---- //
  public runOnTick(): void {
    // console.log(`LaunchRoomProcess ${this.roomName}`)
  }

  // ---- MessageObserver ---- //
  public didReceiveMessage(creepId: unknown): string {
    if (typeof (creepId) !== "string") {
      return `LaunchRoomProcess ${this.processId} invalid message ${creepId}`
    }
    const creep = Game.getObjectById(creepId)
    if (!(creep instanceof Creep)) {
      return `LaunchRoomProcess ${this.processId} invalid message ${creepId}, creep not found`
    }

    const creepBodyParts = creep.body.map(b => b.type)
    if (creepBodyParts.includes(CLAIM)) {
      this.claimerId = creepId
      return `LaunchRoomProcess ${this.processId} received claimer ID`
    }

    if (creepBodyParts.includes(WORK)) {
      this.workerIds.push(creepId)
      return `LaunchRoomProcess ${this.processId} received worker ID`
    }
    return `LaunchRoomProcess ${this.processId} invalid creep ${creepId}, creep has no CLAIM nor WORK parts`
  }
}
