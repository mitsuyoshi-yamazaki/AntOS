import { NativeTextColor } from "shared/utility/console_utility"
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
  // j: "TestTrafficManagerProcess",
  // k: "V3ResourceDistributorProcess",
  l: "DisposeResourceProcess",
  m: "V3BridgeDriverProcess",
  n: "TestTrafficManagerV2Process",
  o: "TestGuardRoomProcess",
  p: "StaticMonoCreepKeeperRoomProcess",
  q: "StaticMonoCreepBuildRoomProcess",
  r: "GenericRoomKeeperProcess",
  s: "GenericRoomManagerProcess",
  t: "TestHarvestRoomProcess",
  u: "TestPullProcess",
  v: "CreepPositionAssignerProcess",
  w: "TerrainCacheProcess",
  x: "OnHeapContinuousTaskProcess",
  y: "TestTrafficManagerV3Process",
  z: "PathManagerProcess",
  aa: "RoomMapProcess",
  ab: "RoomPlannerProcess",
  ac: "ProblemResolverProcess",
  ad: "ClaimRoomProcess",
  ae: "ScoutProcess",
  af: "NukeProcess",
  ag: "ManualCreepOperatorProcess",
  ah: "TemplateProcess",
  ai: "InterShardCommunicatorProcess",
  aj: "ManualRoomPlannerProcess",
  ak: "SaboteurPositionProcess",
  al: "FireControlSystemProcess",
  am: "BootstrapRoomProcess",
  an: "DetectNukeProcess",
} as const

export const deprecatedProcessTypeDecodingMap = {
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
const processDependencyOrder: Readonly<ProcessTypes[]> = [
  // No dependencies
  "RoomPathfindingProcess",
  "CreepDistributorProcess",
  "AttackRoomManagerProcess", // TODO: 実装したら再度確認
  "V3BridgeDriverProcess",
  "TerrainCacheProcess",
  "OnHeapContinuousTaskProcess",
  "RoomMapProcess",
  "RoomPlannerProcess",   // TODO: 実装したら再度確認
  "InterShardCommunicatorProcess",

  // Driver with dependencies
  "PathManagerProcess",
  "CreepTaskStateManagementProcess",
  "V3BridgeSpawnRequestProcess",
  "CreepPositionAssignerProcess",
  "CreepTrafficManagerProcess",

  // Bot
  "MitsuyoshiBotProcess",

  // Application

  // Manager Processes
  "GenericRoomManagerProcess",

  // Process with dependencies
  "TestProcess",
  "EnergyHarvestRoomProcess",
  "StaticMonoCreepKeeperRoomProcess",
  "StaticMonoCreepBuildRoomProcess",
  "DisposeResourceProcess",
  "TestTrafficManagerV2Process",
  "TestTrafficManagerV3Process",
  "TestGuardRoomProcess",
  "GenericRoomKeeperProcess",
  "TestHarvestRoomProcess",
  "TestPullProcess",
  "ScoutProcess",
  "NukeProcess",
  "ManualCreepOperatorProcess",
  "TemplateProcess",
  "ManualRoomPlannerProcess",
  "SaboteurPositionProcess",
  "FireControlSystemProcess",
  "BootstrapRoomProcess",
  "DetectNukeProcess",
  "ProblemResolverProcess",

  // Normalized Processes
  "ClaimRoomProcess",
] as const

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


export type ProcessCategory = "bot" | "application" | "combat" | "economy" | "driver" | "support"
export const categorizedProcessType: { [P in ProcessTypes]: ProcessCategory } = {
  // Bot
  MitsuyoshiBotProcess: "bot",

  // Application

  // Combat
  AttackRoomManagerProcess: "combat",
  ScoutProcess: "combat",
  NukeProcess: "combat",
  SaboteurPositionProcess: "combat",
  FireControlSystemProcess: "combat",
  DetectNukeProcess: "combat",

  // Economy
  GenericRoomManagerProcess: "economy",
  GenericRoomKeeperProcess: "economy",
  EnergyHarvestRoomProcess: "economy",
  StaticMonoCreepKeeperRoomProcess: "economy",
  StaticMonoCreepBuildRoomProcess: "economy",
  DisposeResourceProcess: "economy",
  RoomPlannerProcess: "economy",
  BootstrapRoomProcess: "economy",
  ClaimRoomProcess: "economy",
  ProblemResolverProcess: "economy",

  // Driver
  TerrainCacheProcess: "driver",
  PathManagerProcess: "driver",
  RoomPathfindingProcess: "driver",
  RoomMapProcess: "driver",
  CreepDistributorProcess: "driver",
  CreepTrafficManagerProcess: "driver",
  CreepPositionAssignerProcess: "driver",
  CreepTaskStateManagementProcess: "driver",
  InterShardCommunicatorProcess: "driver",

  // v3 Bridge
  V3BridgeDriverProcess: "driver",
  V3BridgeSpawnRequestProcess: "driver",

  // Support
  TestProcess: "support",
  TestTrafficManagerV2Process: "support",
  TestTrafficManagerV3Process: "support",
  TestGuardRoomProcess: "support",
  TestHarvestRoomProcess: "support",
  TestPullProcess: "support",
  OnHeapContinuousTaskProcess: "support",
  ManualCreepOperatorProcess: "support",
  TemplateProcess: "support",
  ManualRoomPlannerProcess: "support",
} as const

const categoryColor: { [C in ProcessCategory]: NativeTextColor | "none" } = {
  bot: "blue",
  application: "white",
  combat: "red",
  economy: "green",
  driver: "orange",
  support: "none",
} as const

export const coloredProcessType = (processType: ProcessTypes): string => {
  return ConsoleUtility.colored(processType, categoryColor[categorizedProcessType[processType]])
}
