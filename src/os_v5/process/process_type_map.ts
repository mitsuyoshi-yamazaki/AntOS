import { reverseConstMapping } from "shared/utility/strict_entries"


// ProcessTypes
export const processTypeDecodingMap = {
  a: "TestProcess",
  b: "EnergyHarvestRoomProcess",
  c: "V3BridgeSpawnRequestProcess",
  d: "RoomPathfindingProcess",
  e: "CreepTaskStateManagementProcess",
  f: "CreepDistributorProcess",
  g: "MitsuyoshiBotProcess",
} as const


export const processTypeEncodingMap = reverseConstMapping(processTypeDecodingMap)

export type SerializedProcessTypes = keyof typeof processTypeDecodingMap
export type ProcessTypes = keyof typeof processTypeEncodingMap


// Dependency Order
const processDependencyOrder: ProcessTypes[] = [
  // Bot
  "MitsuyoshiBotProcess",

  // Application

  // No dependencies
  "TestProcess",
  "V3BridgeSpawnRequestProcess",
  "RoomPathfindingProcess",
  "CreepDistributorProcess",

  // Driver with dependencies
  "CreepTaskStateManagementProcess",

  // Application process with dependencies
  "EnergyHarvestRoomProcess",
]
export const processExecutionOrder = new Map<ProcessTypes, number>(processDependencyOrder.map((processType, index) => [processType, index]))
