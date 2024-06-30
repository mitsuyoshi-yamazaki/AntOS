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
  h: "AttackRoomManagerProcess",
  i: "CreepTrafficManagerProcess",
  j: "TestTrafficManagerProcess",
  k: "V3ResourceDistributorProcess",
} as const


export const processTypeEncodingMap = reverseConstMapping(processTypeDecodingMap)

export type SerializedProcessTypes = keyof typeof processTypeDecodingMap
export type ProcessTypes = keyof typeof processTypeEncodingMap

const processTypes: ProcessTypes[] = Array.from(Object.values(processTypeDecodingMap))
export const isProcessType = (value: string): value is ProcessTypes => {
  return (processTypes as string[]).includes(value)
}

export type BotTypes = "MitsuyoshiBotProcess"


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
  "AttackRoomManagerProcess", // TODO: 実装したら再度確認
  "CreepTrafficManagerProcess", // TODO: 実装したら再度確認

  // Driver with dependencies
  "CreepTaskStateManagementProcess",

  // Application process with dependencies
  "EnergyHarvestRoomProcess",
  "TestTrafficManagerProcess",
  "V3ResourceDistributorProcess",
]
export const processExecutionOrder = new Map<ProcessTypes, number>(processDependencyOrder.map((processType, index) => [processType, index]))
