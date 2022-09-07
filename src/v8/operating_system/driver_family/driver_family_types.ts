import type { SemanticVersion } from "shared/utility/semantic_version"
import type { Driver } from "../driver"

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
