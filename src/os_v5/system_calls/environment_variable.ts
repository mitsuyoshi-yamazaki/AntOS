import { isPrivateEnvironment } from "../../../submodules/private/constants"
import { SystemCall } from "../system_call"
import { EnvironmentName } from "../drivers/environment"
import { EmptySerializable } from "os_v5/utility/types"

type EnvironmentInfo = {
  readonly name: EnvironmentName
}

type EnvironmentVariable = {
  readonly environment: EnvironmentInfo
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

export const EnvironmentVariable: SystemCall<"EnvironmentVariable", EmptySerializable> & EnvironmentVariable = {
  name: "EnvironmentVariable",
  [Symbol.toStringTag]: "EnvironmentVariable",

  environment: initializeEnvironmentInfo(),

  load(): void {
  },

  startOfTick(): void {
  },

  endOfTick(): EmptySerializable {
    return {}
  },
}
