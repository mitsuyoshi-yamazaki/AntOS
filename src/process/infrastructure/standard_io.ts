import {
  Process,
  ProcessId,
} from "../process"

export class StandardIOProcess implements Process {
  public readonly shouldStore = false

  public constructor(public readonly processId: ProcessId) {
  }

  public run(): void {
  }
}
