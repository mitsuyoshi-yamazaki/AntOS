import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { reverseConstMapping, strictEntries } from "shared/utility/strict_entries"


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
  l: "TrashResourceProcess",
  m: "V3BridgeDriverProcess",
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
  "RoomPathfindingProcess",
  "CreepDistributorProcess",
  "AttackRoomManagerProcess", // TODO: 実装したら再度確認
  "CreepTrafficManagerProcess", // TODO: 実装したら再度確認
  "V3BridgeDriverProcess",

  // Driver with dependencies
  "CreepTaskStateManagementProcess",
  "V3BridgeSpawnRequestProcess",

  // Application with dependencies
  "V3ResourceDistributorProcess",

  // Process with dependencies
  "EnergyHarvestRoomProcess",
  "TestTrafficManagerProcess",
  "TrashResourceProcess",
]
export const processExecutionOrder = new Map<ProcessTypes, number>(processDependencyOrder.map((processType, index) => [processType, index]))


// Debug
const undefinedDependencyOrderProcessTypes = strictEntries(processTypeDecodingMap).flatMap(([, processType]): ProcessTypes[] => {
  const index = processDependencyOrder.indexOf(processType)
  if (index >= 0) {
    return []
  }
  return [processType]
})

if (undefinedDependencyOrderProcessTypes.length > 0) {
  const processTypeList = undefinedDependencyOrderProcessTypes.map(processType => `- ${processType}`).join("\n")
  const errorMessage = ConsoleUtility.colored(`[Program Error] Following process types don't have dependency order: \n${processTypeList}`, "error")
  console.log(errorMessage)
  Game.notify(errorMessage)
}

if (Array.from(Object.keys(processTypeDecodingMap)).length !== processDependencyOrder.length) {
  const errorMessage = ConsoleUtility.colored(`[Program Error] Inconsistent process mapping: ${Array.from(Object.keys(processTypeDecodingMap)).length} : ${processDependencyOrder.length}`, "error")
  console.log(errorMessage)
  Game.notify(errorMessage)
}
