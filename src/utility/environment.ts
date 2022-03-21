type PersistentWorld = "persistent world"
type SimulationWorld = "simulation"
type Season4 = "season 4"
type BotArena = "botarena"

type World = PersistentWorld | SimulationWorld | Season4 | BotArena
type ShardName = string

export interface Environment {
  world: World
  shard: ShardName
  hasMultipleShards: boolean
  description: string

  isAutomatic(): boolean
}

const world = ((): World => {
  switch (Game.shard.name) {
  case "sim":
    return "simulation"
  case "shardSeason":
    return "season 4"
  case "shard0":
  case "shard1":
  case "shard2":
  case "shard3":
    return "persistent world"
  case "botarena":
  default:
    return "botarena"
  }
})()

const hasMultipleShards = ((): boolean => {
  switch (world) {
  case "persistent world":
    return true
  case "season 4":
  case "botarena":
  case "simulation":
    return false
  }
})()

export const Environment: Environment = {
  world,
  shard: Game.shard.name,
  hasMultipleShards: hasMultipleShards,
  description: `${Game.shard.name} in ${world}`,

  isAutomatic(): boolean {  // TODO: メモリからも設定可能にする
    switch (world) {
    case "persistent world":
    case "season 4":
    case "simulation":
      return false
    case "botarena":
      return true
    }
  },
}
