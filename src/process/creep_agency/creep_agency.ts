import {
  Procedural,
  ProcessId,
  StatefulProcess,
} from "../process"

export type CreepProvisionPriority = "cancel_others" | "urgent" | "normal" | "anytime"

export interface CreepAgencyObserver {
  didFindCreep(creep: Creep, id: number): void
}

/**
 * - Creepを調達する
 * - [ ] 手動でも行えるようにする
 */
export class CreepAgencyProcess implements StatefulProcess, Procedural {
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
    // TODO: 暇なcreepを見つける：event detectorで発見できなければ
  }
}
