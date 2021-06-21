import {
  ProcessId,
  StatefulProcess,
} from "../process"

/**
 * - Roomをclaimしてから最初のspawnが稼働を始め、Controllerを維持できるようになるまで
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
