import { OSMemory } from "../os/os"

import { populateLOANlist } from "./loanUserList"
import { standardInput } from "../os/infrastructure/standard_input"
import { SystemInfo } from "utility/system_info"
import type { RoomInfoMemory as V5RoomInfoMemory } from "world_info/room_info"
import type { RoomInfoType } from "room_resource/room_info"
import type { GameInfoMemory } from "game/game_info"
import { Environment } from "utility/environment"
import { EventMemory } from "event_handler/event_memory"
import type { GameMapMemory } from "game/game_map"
import { GclFarmMemory } from "room_resource/gcl_farm_resources"
import { PathCacheMemory } from "prototype/travel_to"
import { StandardInput as v8StandardInput } from "v8/operating_system/system_call/standard_input"

declare global {
  interface Game {
    io: (message: string) => string
    v8: (message: string) => string // TODO: Game.ioに置き換える

    user: { name: 'Mitsuyoshi' }
    systemInfo: string
    environment: string

    // Alliance
    LOANlist: string[]
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

    gameInfo: GameInfoMemory
    room_info: { [index: string]: V5RoomInfoMemory }  // index: RoomName
    v6RoomInfo: { [index: string]: RoomInfoType }  // index: RoomName
    eventMemory: EventMemory
    gameMap: GameMapMemory
    gclFarm: GclFarmMemory
    pathCache: PathCacheMemory

    lastLOANtime: number | undefined
    LOANalliance: string | undefined
  }
}

export function tick(): void {
  // Gameオブジェクトは毎tick更新されるため
  Game.io = standardInput

  Game.v8 = v8StandardInput.input

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

  populateLOANlist()
  Game.whitelist = [...Game.LOANlist].concat(Memory.gameInfo.whitelist)
}
