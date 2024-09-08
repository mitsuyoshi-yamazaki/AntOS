import type { AnyProcess } from "os_v5/process/process"
import type { MyRoom } from "shared/utility/room"
import type { SemanticVersion } from "shared/utility/semantic_version"


export type BotApi = {
  readonly botInfo: {
    readonly name: string
    readonly identifier: string
    readonly version: SemanticVersion
  }

  getManagingRooms(): MyRoom[]
  registerChildProcess(process: AnyProcess): void
}
