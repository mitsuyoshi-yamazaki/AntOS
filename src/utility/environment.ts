type PersistentWorld = "persistent world"
type SimulationWorld = "simulation"
type Season3 = "season 3"

type World = PersistentWorld | SimulationWorld | Season3
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
  default:
    return "persistent world"
  }
})()

export const Environment: Environment = {
  world,
  shard: Game.shard.name,
}
