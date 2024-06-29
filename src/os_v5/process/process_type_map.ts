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
  i: "CreepTrafficManagementProcess",
  j: "TestTrafficManagementProcess",
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
  "CreepTrafficManagementProcess", // TODO: 実装したら再度確認

  // Driver with dependencies
  "CreepTaskStateManagementProcess",

  // Application process with dependencies
  "EnergyHarvestRoomProcess",
  "TestTrafficManagementProcess",
]
export const processExecutionOrder = new Map<ProcessTypes, number>(processDependencyOrder.map((processType, index) => [processType, index]))
