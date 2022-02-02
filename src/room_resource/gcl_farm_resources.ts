import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Position } from "prototype/room_position"
import { roomLink } from "utility/log"
import { RoomName } from "utility/room_name"

export type GclFarmMemory = {
  roomNames: RoomName[]
}

export type GclFarmDeliverTarget = Creep | StructureContainer | StructureStorage
type GclFarmInfo = {
  deliverDestinationPosition: Position
  deliverTargetId: Id<GclFarmDeliverTarget> | null
}

const gclFarmInfo = new Map<RoomName, GclFarmInfo>()

export const GclFarmResources = {
  // ---- Room ---- //
  gclFarmRoomNames(): RoomName[] {
    return [...Memory.gclFarm.roomNames]
  },

  isGclFarm(roomName: RoomName): boolean {
    return Memory.gclFarm.roomNames.includes(roomName)
  },

  addFarmRoom(roomName: RoomName): void {
    Memory.gclFarm.roomNames.push(roomName)
  },

  removeFarmRoom(roomName: RoomName): void {
    const index = Memory.gclFarm.roomNames.indexOf(roomName)
    if (index >= 0) {
      Memory.gclFarm.roomNames.splice(index, 1)
    }
  },

  // ---- Info ---- //
  getFarmInfo(roomName: RoomName): GclFarmInfo | null {
    return gclFarmInfo.get(roomName) ?? null
  },

  setDeliverDestination(roomName: RoomName, deliverDestinationPosition: Position): void {
    const stored = gclFarmInfo.get(roomName)
    if (stored != null) {
      stored.deliverDestinationPosition = deliverDestinationPosition
      return
    }

    const newInfo: GclFarmInfo = {
      deliverDestinationPosition,
      deliverTargetId: null
    }
    gclFarmInfo.set(roomName, newInfo)
  },

  setDeliverTarget(roomName: RoomName, targetId: Id<GclFarmDeliverTarget>): void {
    const stored = gclFarmInfo.get(roomName)
    if (stored == null) {
      PrimitiveLogger.programError(`GclFarmResources.setDeliverTarget() no GCL farm info for ${roomLink(roomName)}`)
      return
    }
    stored.deliverTargetId = targetId
  },
}
