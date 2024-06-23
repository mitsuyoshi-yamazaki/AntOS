import { isPrivateEnvironment } from "../../../submodules/private/constants"
import { SystemCall } from "../system_call"
import { EmptySerializable } from "os_v5/utility/types"


export enum EnvironmentName {
  mmo = "mmo",
  sim = "sim",
  swc = "swc",
  botarena = "botarena",
  private = "private",
  mockSeason = "mockSeason", /// シーズンマッチ未開催時
  unknown = "unknown",
}


type EnvironmentInfo = {
  readonly name: EnvironmentName
}

type Environment = {
  readonly info: EnvironmentInfo
}

const initializeEnvironmentInfo = (): EnvironmentInfo => {
  const shardName = Game.shard.name
  switch (shardName) {
  case "sim":
    return {
      name: EnvironmentName.sim,
    }

  case "shardSeason":
    return {
      name: EnvironmentName.mockSeason,
    }

  case "shard0":
  case "shard1":
  case "shard2":
  case "shard3":
    return {
      name: EnvironmentName.mmo,
    }

  case "swc":
    return {
      name: EnvironmentName.swc,
    }

  case "botarena":
    return {
      name: EnvironmentName.botarena,
    }

  default:
    if (isPrivateEnvironment(shardName) === true) {
      return {
        name: EnvironmentName.private,
      }
    }
    return {
      name: EnvironmentName.unknown,
    }
  }
}

export const Environment: SystemCall<"Environment", EmptySerializable> & Environment = {
  name: "Environment",
  [Symbol.toStringTag]: "Environment",

  info: initializeEnvironmentInfo(),

  load(): void {
  },

  startOfTick(): void {
  },

  endOfTick(): EmptySerializable {
    return {}
  },
}
