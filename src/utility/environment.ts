import { isPrivateEnvironment } from "../../submodules/private/constants"

type PersistentWorld = "persistent world"
type SimulationWorld = "simulation"
type Season4 = "season 4"
type BotArena = "botarena"
type Swc = "swc"
type PrivateEnvironment = "private"
type NonGame = "non game" // 本来 non game 環境は上段で分けてゲーム処理に混入しないようにするべき
type UnknownEnvironment = "unknown"

type World = PersistentWorld | SimulationWorld | Season4 | BotArena | Swc | PrivateEnvironment | NonGame | UnknownEnvironment
type ShardName = string

export interface Environment {
  world: World
  shard: ShardName
  hasMultipleShards: boolean
  description: string

  isAutomatic(): boolean
  isTeamMatch(): boolean
}

const world = ((): World => {
  const shardName = Game.shard.name
  switch (shardName) {
  case "sim":
    // return "simulation"
    return "non game"  // memhackより先に読み込まれてしまうためメモリに書き込むことができない。現状はコードを書き換えることで対応する
  case "shardSeason":
    return "season 4"
  case "shard0":
  case "shard1":
  case "shard2":
  case "shard3":
    return "persistent world"
  case "swc":
    return "swc"
  case "botarena":
    return "botarena"
  default:
    if (isPrivateEnvironment(shardName) === true) {
      return "private"
    }
    return "unknown"
  }
})()

const hasMultipleShards = ((): boolean => {
  switch (world) {
  case "persistent world":
    return true
  case "season 4":
  case "botarena":
  case "swc":
  case "simulation":
  case "private":
  case "non game":
  case "unknown":
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
    case "swc":
    case "simulation":
    case "non game":
      return false
    case "botarena":
    case "private":
    case "unknown":
      return true
    }
  },

  isTeamMatch(): boolean {
    switch (world) {
    case "persistent world":
    case "season 4":
    case "simulation":
    case "botarena":
    case "private":
    case "non game":
    case "unknown":
      return false
    case "swc":
      return true
    }
  }
}
