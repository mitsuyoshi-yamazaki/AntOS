import { reverseConstMapping } from "shared/utility/strict_entries"

// ProcessTypes
export const processTypeDecodingMap = {
  a: "TestProcess",
  b: "EnergyHarvestRoomProcess",
  c: "V3BridgeSpawnRequestProcess",
  d: "RoomPathfindingProcess",
} as const

export const processTypeEncodingMap = reverseConstMapping(processTypeDecodingMap)

export type SerializedProcessTypes = keyof typeof processTypeDecodingMap
export type ProcessTypes = keyof typeof processTypeEncodingMap
