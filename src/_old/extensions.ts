import { OSMemory } from "../os/os"

import { LeagueOfAutomatedNations } from "./loanUserList"
import { SystemInfo } from "shared/utility/system_info"
import type { RoomInfoMemory as V5RoomInfoMemory } from "world_info/room_info"
import type { RoomInfoType } from "room_resource/room_info"
import type { GameInfoMemory } from "game/game_info"
import { Environment } from "utility/environment"
import type { GameMapMemory } from "game/game_map"
import { GclFarmMemory } from "room_resource/gcl_farm_resources"
import { PathCacheMemory } from "prototype/travel_to"
import { UniqueIdMemory } from "utility/unique_id"
import { RoomName } from "shared/utility/room_name_types"
import { IntegratedAttackMemory } from "../../submodules/private/attack/integrated_attack/integrated_attack"

declare global {
  interface Game {
    user: { name: 'Mitsuyoshi' }
    systemInfo: string
    environment: string

    // Alliance
    whitelist: string[]
    isEnemy(player: Owner): boolean
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
    integratedAttack: IntegratedAttackMemory

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
