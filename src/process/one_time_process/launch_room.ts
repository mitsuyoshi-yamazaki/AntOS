import {
  Procedural,
  ProcessId,
  StatefulProcess,
} from "../process"

export class LaunchRoomProcess implements StatefulProcess, Procedural {
  public readonly shouldStore = true

  public constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
  ) {
  }

  // ---- StatefulProcess ---- //
  public encode(): unknown {
    return {}
  }

  // ---- Procedural ---- //
  public runOnTick(): void {
  }
}
