import { OperatingSystem } from "./os"
import { SystemCall } from "./system_call"

type ScreepsSystemCall = SystemCall & {
  //
}

export class ScreepsOS extends OperatingSystem<ScreepsSystemCall> {
}
