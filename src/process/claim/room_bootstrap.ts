import {
  ProcessId,
  StatefulProcess,
} from "../process"

/**
 * - Roomをclaimしてから最初のspawnが稼働を始めるまで
 */
export class RoomBootstrapProcess implements StatefulProcess {
  public readonly shouldStore = true

  public constructor(public readonly processId: ProcessId) {
  }

  // ---- StatefulProcess ---- //
  public encode(): unknown {
    return {}
  }
}
