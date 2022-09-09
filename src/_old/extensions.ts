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

declare global {
  interface Game {
    user: { name: 'Mitsuyoshi' }
    systemInfo: string
    environment: string

    // Alliance
    whitelist: string[]
    isEnemy(player: Owner): boolean

    canSkipSerialization: boolean
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
    gclFarm: GclFarmMemory
    ignoreRooms: RoomName[]
    pathCache: PathCacheMemory

    LOANalliance: string | undefined
    napAlliances: string[]
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
}
