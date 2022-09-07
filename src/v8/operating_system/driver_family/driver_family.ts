/**
 # DriverFamily
 ## 概要
 DriverFamilyはBotの認知の基礎を成すDriverの集合
 */

import { SemanticVersion } from "shared/utility/semantic_version"
import { Driver } from "../driver"

type DriverFamilyName = "Beryllium" | "Magnesium" | "Calcium" | "Strontium" | "Barium" | "Radium"

type DriverFamily = {
  readonly name: DriverFamilyName
  readonly description: string
  readonly version: SemanticVersion
  readonly drivers: Driver[]
}

const Beryllium: DriverFamily = {
  name: "Beryllium",
  description: "",  // TODO:
  version: new SemanticVersion(1, 0, 0),
  drivers: [

  ],
}

export const DriverFamily = {
  Beryllium,
}
