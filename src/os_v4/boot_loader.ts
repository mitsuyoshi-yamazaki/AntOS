import { SemanticVersion } from "shared/utility/semantic_version"
import { DriverSet } from "./driver"
import { TransportManager } from "./driver/transport_manager"
import { ScreepsDrivers, ScreepsOS } from "./screeps_os"
import { SystemCallSet } from "./system_call_set"

export const bootLoader = {
  load(): ScreepsOS {
    const screepsDriverSet: DriverSet<ScreepsDrivers> = {
      transport_manager: new TransportManager(SystemCallSet, {}),
    }

    return new ScreepsOS(
      SystemCallSet,
      screepsDriverSet,
      new SemanticVersion(4, 0, 0),
    )
  },
}
