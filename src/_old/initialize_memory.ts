import { } from "_old/extensions" // Memory拡張を読み込むため

export function initializeMemory(): void {
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

  if (Memory.v3 == null) {
    Memory.v3 = {rooms: []}
  } else {
    if (Memory.v3.rooms == null) {
      Memory.v3.rooms = []
    }
  }

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

  if (Memory.reporter == null) {
    Memory.reporter = {
      reportTimeHour: 0,
      reportStoreDuration: 2,
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

  if (Memory.integratedAttack == null) {
    Memory.integratedAttack = {
      rooms: {},
    }
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
