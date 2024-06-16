import { reverseConstMapping } from "shared/utility/strict_entries"

export const processTypeDecodingMap = {
  a: "TestProcess",
  b: "EnergyHarvestRoomProcess",
} as const

export const processTypeEncodingMap = reverseConstMapping(processTypeDecodingMap)

export type SerializedProcessTypes = keyof typeof processTypeDecodingMap
export type ProcessTypes = keyof typeof processTypeEncodingMap
