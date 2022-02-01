import { Invader } from "game/invader"
import { RoomResources } from "room_resource/room_resources"
import { GameConstants } from "utility/constants"
import { profileLink, roomLink } from "utility/log"
import { Timestamp } from "utility/timestamp"
import { GclFarmRoom } from "./gcl_farm_types"

/**
   * - 条件：
   *   - targetはInvader以外にclaimされていない
   *   - targetはInvaderか自分以外にreserveされていない
   *   - parent roomsはtargetの隣（通路が空いている）
   *   - parent roomsはRCL8以上
   *   - parent roomsは完全（Spawn, Storage, Terminal等の存在
   */
export function validateGclFarmTarget(target: GclFarmRoom): { errors: string[] } {
  const errors: string[] = []
  const targetRoomInfo = RoomResources.getRoomInfo(target.roomName)

  if (targetRoomInfo == null) {
    return {
      errors: [`target ${roomLink(target.roomName)} is not observed`]
    }
  }

  const getRelativeTime = (timestamp: Timestamp): string => {
    if (timestamp < 1000) {
      return `${Game.time - timestamp} ticks ago`
    }
    return `${Math.floor((Game.time - timestamp) / 1000)}k ticks ago`
  }

  switch (targetRoomInfo.roomType) {
  case "owned":
    errors.push(`target ${roomLink(target.roomName)} is already mine`)
    break
  case "normal":
    if (targetRoomInfo.owner != null) {
      switch (targetRoomInfo.owner.ownerType) {
      case "claim":
        if (targetRoomInfo.owner.username !== Invader.username) {
          errors.push(`target ${roomLink(target.roomName)} is owned by ${profileLink(targetRoomInfo.owner.username)} ${getRelativeTime(targetRoomInfo.observedAt)}`)
        }
        break
      case "reserve":
        if ([Invader.username, Game.user.name].includes(targetRoomInfo.owner.username) !== true) {
          errors.push(`target ${roomLink(target.roomName)} is reserved by ${profileLink(targetRoomInfo.owner.username)} ${getRelativeTime(targetRoomInfo.observedAt)}`)
        }
        break
      }
    }
    break
  }

  const neighbourRoomNames = [...targetRoomInfo.neighbourRoomNames]

  target.parentRoomNames.forEach(parentRoomName => {
    if (neighbourRoomNames.includes(parentRoomName) !== true) {
      errors.push(`parent room ${roomLink(parentRoomName)} is not next to the target ${roomLink(target.roomName)}`)
      return
    }

    const parentRoomResource = RoomResources.getOwnedRoomResource(parentRoomName)
    if (parentRoomResource == null) {
      errors.push(`parent room ${roomLink(parentRoomName)} is not owned`)
      return
    }
    if (parentRoomResource.controller.level < 8) {
      errors.push(`parent room ${roomLink(parentRoomName)} is under development (RCL${parentRoomResource.controller.level})`)
      return
    }
    if (
      parentRoomResource.activeStructures.terminal == null
      || parentRoomResource.activeStructures.storage == null
      || parentRoomResource.activeStructures.spawns.length < GameConstants.structure.maxCount.spawn
    ) {
      errors.push(`parent room ${roomLink(parentRoomName)} lack of vital structures`)
      return
    }
  })

  return {
    errors,
  }
}
