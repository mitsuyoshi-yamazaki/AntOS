import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { OperatingSystem } from "os/os"
import { Environment } from "utility/environment"
import { coloredText } from "utility/log"

export function isRespawned(): boolean {
  if (Object.keys(Game.creeps).length > 0) {
    return false
  }
  if (Object.keys(Game.spawns).length > 1) {
    return false
  }
  if (Object.keys(Game.rooms).length > 1) {
    return false
  }
  const world = Environment.world
  switch (world) {
  case "persistent world":
  case "season 3":
    PrimitiveLogger.fatal(`No spawn in ${world}`)
    return false  // TODO:
  case "botarena":
  case "simulation":
    break
  }
  for (const [, room] of Object.entries(Game.rooms)) {
    if (room.controller == null || room.controller.my !== true) {
      return true
    }
    if (room.controller.level > 1) {
      return false
    }
    if (room.controller.progress > 0) {
      return false
    }
    if (room.controller.safeMode == null) {
      return false
    }
    if (room.controller.safeMode < (SAFE_MODE_DURATION - 1)) {
      return false
    }
  }
  return true
}

export function resetOldSpawnData(): void {
  PrimitiveLogger.notice(`${coloredText("[Warning]", "critical")} reset old data at ${Game.time}`)

  const roomInfoKeys = Object.keys(Memory.room_info)
  roomInfoKeys.forEach(key => {
    delete Memory.room_info[key]
  })

  const v6RoomInfoKeys = Object.keys(Memory.v6RoomInfo)
  v6RoomInfoKeys.forEach(key => {
    delete Memory.v6RoomInfo[key]
  })

  OperatingSystem.os.respawned()
}
