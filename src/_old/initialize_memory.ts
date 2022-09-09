import { } from "_old/extensions" // Memory拡張を読み込むため
import { SystemInfo } from "shared/utility/system_info"

export function initializeMemory(): void {
  if (!Memory.versions) {
    Memory.versions = []
  }
  const version = SystemInfo.application.version
  if (Memory.versions.indexOf(version) < 0) {
    const removeCount = 10
    if (Memory.versions.length > (removeCount * 2)) {
      Memory.versions.splice(removeCount, Memory.versions.length - removeCount)
    }

    Memory.versions.push(version)
    console.log(`Updated v${version}`)
  }

  if (Memory.uniqueId == null) {
    Memory.uniqueId = {
      creepNameIndex: 0,
    }
  }
  if (Memory.gameInfo == null) {
    Memory.gameInfo = {
      whitelist: [],
      sourceHarvestWhitelist: [],
    }
  }
  if (Memory.gameInfo.whitelist == null) {
    Memory.gameInfo.whitelist = []
  }
  if (Memory.gameInfo.sourceHarvestWhitelist == null) {
    Memory.gameInfo.sourceHarvestWhitelist = []
  }
  // if (Memory.v3 == null) { // EnvironmentalVariableのロード時に存在する必要があるためそちらで行っている
  //   Memory.v3 = {
  //     enabled: false,
  //     process: {
  //       processIdIndex: 0,
  //       processInfoMemories: {},
  //     },
  //   }
  // }

  if (Memory.room_info == null) {
    Memory.room_info = {}
  }

  if (Memory.v6RoomInfo == null) {
    Memory.v6RoomInfo = {}
  }

  if (Memory.gameMap == null) {
    Memory.gameMap = {
      interRoomPath: {}
    }
  }

  if (Memory.gclFarm == null) {
    Memory.gclFarm = {
      roomNames: [],
    }
  }

  if (Memory.ignoreRooms == null) {
    Memory.ignoreRooms = []
  }

  if (Memory.pathCache == null) {
    Memory.pathCache = {
      paths: {}
    }
  }

  if (Memory.rooms == null) {
    Memory.rooms = {}
  }

  if (!Memory.cpu) {
    Memory.cpu = {
      last_bucket: Game.cpu.bucket
    }
  }

  if (!Memory.cpu_usages) {
    Memory.cpu_usages = []
  }

  if (Memory.napAlliances == null) {
    Memory.napAlliances = []
  }

  if (Memory.skipSerialization == null) {
    Memory.skipSerialization = {
      by: null,
      interval: null,
      test: false,
    }
  }
}
