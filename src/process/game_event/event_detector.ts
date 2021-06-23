import { Procedural, ProcessId, StatefulProcess } from "process/process"

export interface EventDetectorProcessMemory {

}

export class EventDetectorProcess implements StatefulProcess, Procedural {
  public readonly shouldStore = true

  public constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
  ) {
  }

  // ---- StatefulProcess ---- //
  public static parseState(rawState: unknown): EventDetectorProcessMemory | null {
    const state = rawState as EventDetectorProcessMemory
    return null // TODO:
  }

  public encode(): EventDetectorProcessMemory {
    return {
    }
  }

  // ---- Procedural ---- //
  public runOnTick(): void {
  }
}
