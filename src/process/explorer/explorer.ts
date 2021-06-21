import {
  Procedural,
  ProcessId,
  StatefulProcess,
} from "../process"

export interface ExplorerProcessMemory {
}

/**
 * - scoutを放って周囲を探索する
 * - 探索目的
 *   - portal
 *     - distance from spawn
 *   - territory
 *     - hostility
 *   - room exits
 */
export class ExplorerProcess implements StatefulProcess, Procedural {
  public readonly shouldStore = true

  public constructor(public readonly processId: ProcessId) {
  }

  // ---- StatefulProcess ---- //
  public encode(): ExplorerProcessMemory {
    return {}
  }

  // ---- Procedural ---- //
  public runOnTick(): void {
  }
}
