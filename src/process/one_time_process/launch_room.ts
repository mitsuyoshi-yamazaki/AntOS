import {
  Procedural,
  ProcessId,
  StatefulProcess,
} from "../process"

interface LaunchRoomProcessMemory {
  r: string // roomName
}

export class LaunchRoomProcess implements StatefulProcess, Procedural {
  public readonly shouldStore = true

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
      r: this.roomName
    }
  }

  // ---- Procedural ---- //
  public runOnTick(): void {
    console.log(`LaunchRoomProcess ${this.roomName}`)
  }
}
