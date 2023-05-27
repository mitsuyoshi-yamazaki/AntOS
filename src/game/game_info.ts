export interface GameInfoMemory {
  whitelist: string[]
  sourceHarvestWhitelist: string[]
  disableEnergyTransfer?: boolean
  disableResourceTransfer?: boolean
  disableMineralHarvesting?: boolean
  enableCpuOptimization?: boolean
  activeShards?: string[]
  losingRoomNames?: string[]
}
