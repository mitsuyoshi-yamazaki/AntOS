import { SemanticVersion } from "shared/utility/semantic_version"
import { DriverFamily } from "../driver_family/driver_family_types"

export const Beryllium: DriverFamily = {
  displayName: "Beryllium Bot",
  identifier: "Beryllium",
  prefix: "be",
  description: "",  // TODO:
  version: new SemanticVersion(10, 0, 0),
  drivers: [
  ],
}
