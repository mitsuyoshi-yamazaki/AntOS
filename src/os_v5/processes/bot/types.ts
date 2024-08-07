import type { SemanticVersion } from "shared/utility/semantic_version"

export type BotApi = {
  readonly botInfo: {
    readonly name: string
    readonly identifier: string
    readonly version: SemanticVersion
  }
}
