import {
  ProcessId,
  Procedural,
  StatefulProcess,
} from "../process"
import { MessageObserver } from "../infrastructure/messenger"

interface ScoutCreepProcessMemory {
  c: string   // creepId
  r: string // routes (room_name1,room_name2,...)
}

// W54S8,W55S8,W55S9,W56S9,W56S8
export class ScoutCreepProcess implements StatefulProcess, Procedural, MessageObserver {
  public readonly shouldStore = true

  private routes: string[]

  public constructor(
    public readonly processId: ProcessId,
    public readonly creepId: string,
    routes: string[],
  ) {
    this.routes = routes
  }

  // ---- StatefulProcess ---- //
  public static parseState(rawState: unknown): {creepId: string, routes: string[]} | null {
    const state = rawState as ScoutCreepProcessMemory
    if (typeof state.c !== "string" || typeof state.r !== "string") {
      return null
    }
    return {
      creepId: state.c,
      routes: state.r.split(","),
    }
  }

  public encode(): ScoutCreepProcessMemory {
    return {
      c: this.creepId,
      r: this.routes.join(","),
    }
  }

  // ---- Procedural ---- //
  public runOnTick(): void {
    console.log(`ScoutCreepProcess running with creep id: ${this.creepId} at ${Game.time}`)
    const creep = Game.getObjectById(this.creepId) as Creep
    if (!(creep instanceof Creep)) {
      console.log(`ScoutCreepProcess invalid creep ID ${this.creepId}`)
      return
    }
    creep.say("I'm scout")
  }

  // ---- MessageObserver ---- //
  public didReceiveMessage(message: unknown): void {
    if (typeof (message) !== "string") {
      console.log(`ScoutCreepProcess invalid message ${message}`)
      return
    }
    this.routes = message.split(",")
    console.log(`ScoutCreepProcess message received ${message}`)
  }
}
