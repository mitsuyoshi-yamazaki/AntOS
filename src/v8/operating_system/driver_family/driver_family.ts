/**
 # DriverFamily
 ## 概要
 DriverFamilyはBotの認知の基礎を成すDriverの集合
 */

import { SemanticVersion } from "shared/utility/semantic_version"
import { Driver } from "../driver"

type DriverFamilyName = "Beryllium" | "Magnesium" | "Calcium" | "Strontium" | "Barium" | "Radium"

export type DriverFamily = {
  /** nameはFamilyの特定に用いるため一意 */
  readonly name: DriverFamilyName

  /** shortNameはDriverCommandの指定で用いるため一意 */
  readonly shortName: string
  readonly description: string
  readonly version: SemanticVersion
  readonly drivers: Driver[]
}

const Beryllium: DriverFamily = {
  name: "Beryllium",
  shortName: "be",
  description: "",  // TODO:
  version: new SemanticVersion(1, 0, 0),
  drivers: [
  ],
}

export const DriverFamily = {
  Beryllium,
}
