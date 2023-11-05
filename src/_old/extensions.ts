import { LeagueOfAutomatedNations } from "./loanUserList"
import { SystemInfo } from "shared/utility/system_info"
import type { RoomInfoMemory as V5RoomInfoMemory } from "world_info/room_info"
import type { RoomInfoType } from "room_resource/room_info"
import type { GameInfoMemory } from "game/game_info"
import { Environment } from "utility/environment"
import type { GameMapMemory } from "game/game_map"
import type { GclFarmMemory } from "room_resource/gcl_farm_resources"
import type { PathCacheMemory } from "prototype/travel_to"
import type { UniqueIdMemory } from "utility/unique_id"
import type { RoomName } from "shared/utility/room_name_types"
import type { OSMemory } from "os/os_memory"
import { coloredText } from "utility/log"
import { IntegratedAttackMemory } from "../../submodules/private/attack/integrated_attack/integrated_attack"
import { ReporterMemory } from "process/process/report/reporter"

const serialization = {
  canSkip: false,
  shouldSerializeInNextTick: false,
  finished: false,  // serializeしたかどうかに関わらず、tick中の処理が終わったらtrue. consoleで手動処理を行った際にshouldSerializeInNextTickを有効化するために用いる
}

declare global {
  interface Game {
    user: { name: 'Mitsuyoshi' }
    systemInfo: string
    environment: string

    // Alliance
    whitelist: string[]
    isEnemy(player: Owner): boolean

    serialization: {
      shouldSerializeMemory(): void
      canSkip(): boolean

      /** memhack以外から呼び出さないこと */
      tickFinished(): void
    }
  }

  interface Memory {
    os: OSMemory
    versions: string[]
    cpu_usages: number[]
    cpu: {
      last_bucket: number
    }

    uniqueId: UniqueIdMemory
    gameInfo: GameInfoMemory
    room_info: { [index: string]: V5RoomInfoMemory }  // index: RoomName
    v6RoomInfo: { [index: string]: RoomInfoType }  // index: RoomName
    gameMap: GameMapMemory
    reporter: ReporterMemory
    gclFarm: GclFarmMemory
    ignoreRooms: RoomName[]
    pathCache: PathCacheMemory
    integratedAttack: IntegratedAttackMemory

    LOANalliance: string | undefined
    napAlliances: string[]

    skipSerialization: {
      by: number | null
      interval: number | null
      test: boolean
    }
  }
}

// Gameオブジェクトは毎tick更新されるため
export function tick(): void {
  Game.user = {
    name: 'Mitsuyoshi',
  }
  Game.systemInfo = `${SystemInfo.os.name} v${SystemInfo.os.version} - ${SystemInfo.application.name} v${SystemInfo.application.version}`
  Game.environment = `${Environment.world}: ${Environment.shard}`

  Game.isEnemy = function(player: Owner): boolean {
    if (player.username === Game.user.name) {
      return false
    }
    return Game.whitelist.includes(player.username) !== true
  }

  LeagueOfAutomatedNations.populate()
  Game.whitelist = [...LeagueOfAutomatedNations.LOANlist].concat(Memory.gameInfo.whitelist)

  // ---- Serialization ---- //
  serialization.canSkip = false // FixMe: デバッグコード

  // if (serialization.shouldSerializeInNextTick === true) {
  //   serialization.canSkip = false
  // } else {
  //   serialization.canSkip = ((): boolean => {
  //     // if (Memory.skipSerialization.test === true) {
  //     //   return true  // テストコード無効化
  //     // }
  //     if (Memory.skipSerialization.by != null && Game.time < Memory.skipSerialization.by) {
  //       return true
  //     }
  //     if (Memory.skipSerialization.interval != null && ((Game.time % Memory.skipSerialization.interval) !== 0)) {
  //       return true
  //     }
  //     return false
  //   })()
  // }
  serialization.finished = false
  serialization.shouldSerializeInNextTick = false

  Game.serialization = {
    canSkip(): boolean {
      return serialization.canSkip
    },

    shouldSerializeMemory(): void {
      if (serialization.finished === true) {
        if (serialization.shouldSerializeInNextTick === true) {
          return
        }
        serialization.shouldSerializeInNextTick = true
        console.log(`${coloredText("[CAUTION]", "critical")} turn on serialization in next tick (${Game.time})`)
        return
      }
      if (serialization.canSkip !== true) {
        console.log(`${coloredText("[CAUTION]", "critical")} turn on serialization at ${Game.time}`)
      }
      serialization.canSkip = true
    },

    tickFinished(): void {
      serialization.finished = true
    },
  }

  if (Game.serialization.canSkip() === true) {
    console.log(`${coloredText("[CAUTION]", "critical")} can skip memory serialization at ${Game.time}`)
  }
}
