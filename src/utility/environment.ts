type PersistentWorld = "persistent world"
type SimulationWorld = "simulation"
type Season3 = "season 3"
type BotArena = "botarena"

type World = PersistentWorld | SimulationWorld | Season3 | BotArena
type ShardName = string

export interface Environment {
  world: World
  shard: ShardName
}

const world = ((): World => {
  switch (Game.shard.name) {
  case "sim":
    return "simulation"
  case "shardSeason":
    return "season 3"
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

export const Environment: Environment = {
  world,
  shard: Game.shard.name,
}
