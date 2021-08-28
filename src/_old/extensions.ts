import { OSMemory } from "../os/os"

import { populateLOANlist } from "./loanUserList"
import { standardInput } from "../os/infrastructure/standard_input"
import { SystemInfo } from "utility/system_info"
import type { RoomInfoMemory as V5RoomInfoMemory } from "world_info/room_info"
import type { RoomInfoType } from "room_resource/room_info"
import type { GameInfoMemory } from "game/game_info"
import { Environment } from "utility/environment"

export interface SectorMemory {
  name: string
  regions: string[]
}

declare global {
  interface Game {
    io: (message: string) => string

    user: { name: 'Mitsuyoshi' }
    systemInfo: string
    environment: string

    // Alliance
    LOANlist: string[]
    whitelist: string[]
    isEnemy(player: Owner): boolean
  }

  interface Memory {
    last_tick: number
    os: OSMemory
    versions: string[]
    cpu_usages: number[]
    cpu: {
      last_bucket: number
    }

    gameInfo: GameInfoMemory
    room_info: { [index: string]: V5RoomInfoMemory }  // index: RoomName
    v6RoomInfo: { [index: string]: RoomInfoType }  // index: RoomNa

    lastLOANtime: number | undefined
    LOANalliance: string | undefined
  }
}

export function init() {
}

export function tick(): void {
  // Gameオブジェクトは毎tick更新されるため
  Game.io = standardInput

  Game.user = {
    name: 'Mitsuyoshi',
  }
  Game.systemInfo = `${SystemInfo.os.name} v${SystemInfo.os.version} - ${SystemInfo.application.name} v${SystemInfo.application.version}`
  Game.environment = `${Environment.world}: ${Environment.shard}`

  Game.isEnemy = function(player: Owner): boolean {
    return Game.whitelist.includes(player.username) !== true
  }

  populateLOANlist()
  Game.whitelist = [...Game.LOANlist].concat(Memory.gameInfo.whitelist)
}
