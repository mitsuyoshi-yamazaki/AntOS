import {
  ProcessId,
  Procedural,
  StatefulProcess,
} from "../process"

export class ScoutCreepProcess implements StatefulProcess, Procedural {
  public readonly shouldStore = true

  public constructor(
    public readonly processId: ProcessId,
    public readonly creepId: string,
  ) {
  }

  // ---- StatefulProcess ---- //
  public static parseState(rawState: unknown): { creepId: string } | null {
    const state = rawState as { c?: string }
    if (typeof state.c !== "string") {
      return null
    }
    return {
      creepId: state.c
    }
  }

  public encode(): unknown {
    return {
      c: this.creepId,
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
}
