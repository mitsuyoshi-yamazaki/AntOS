/**
 # DriverFamily
 ## 概要
 DriverFamilyはBotの認知の基礎を成すDriverの集合
 BotはOS上で動作するDriverとProcessの集合

 ## 仕様
 Botのidentifierはmajor versionと対応する
 */

import { SemanticVersion } from "shared/utility/semantic_version"
import { Driver } from "../driver"

type DriverFamilyName = "Beryllium" | "Magnesium" | "Calcium" | "Strontium" | "Barium" | "Radium"

export type DriverFamily = {
  readonly displayName: string

  /** identifierはFamilyの特定に用いるため一意 */
  readonly identifier: DriverFamilyName

  /** prefixはDriverCommandの指定で用いるため一意 */
  readonly prefix: string
  readonly description: string
  readonly version: SemanticVersion
  readonly drivers: Driver[]
}

const Beryllium: DriverFamily = {
  displayName: "Beryllium Bot",
  identifier: "Beryllium",
  prefix: "be",
  description: "",  // TODO:
  version: new SemanticVersion(10, 0, 0),
  drivers: [
  ],
}

export const DriverFamily = {
  Beryllium,
}
