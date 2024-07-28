// ---- Base Functions ---- //
import { ErrorMapper } from "error_mapper/ErrorMapper"
import {} from "shared/prototype/game"

// ---- v2 OS ---- //
import { OperatingSystem } from "os/os"
import { isRespawned, resetOldSpawnData } from "script/respawn"
import { tick as initializerTick } from "_old/init"
import { standardInput } from "os/infrastructure/standard_input"
import { initializeMemory } from "_old/initialize_memory"
import { Environment } from "utility/environment"

// ---- v5 OS ---- //
import { BootLoader as v5BootLoader } from "os_v5/boot_loader"

/**
 * OSとメイン処理の結合
 * 複数のOSが共存することによる標準入出力の名前空間の解決などもここで行う
 */

type RootFunctions = {
  load(): void
  loop(): void
}

export const BootLoader = {
  load(): RootFunctions {
    switch (Environment.world) {
    case "private":
      return v2Functions()

    case "persistent world":
      switch (Environment.shard) {
      case "shard3":
        return shard3Functions()
      default:
        break
      }
      return v5ExperimentalFunctions() // FixMe: Debug

    case "botarena":
    case "season 4":
    case "season 5":
    case "simulation":
    case "swc":
    case "non game":  // ApplicationProcessLoader以外のOS機能は動作させる
    case "unknown":
      return v5ExperimentalFunctions() // FixMe: Debug
    }
  }
}

const shard3Functions = (): RootFunctions => {
  return {
    load(): void {
      initializeMemory()

      ErrorMapper.wrapLoop(() => {
        v5BootLoader.load()
      }, "v5BootLoader.load()")()
    },

    loop(): void {
      ErrorMapper.wrapLoop(() => {
        initializerTick()
      }, "initializerTick")()

      ErrorMapper.wrapLoop(() => {
        v5BootLoader.run(Game)
      }, "v5BootLoader.run()")()
    },
  }
}

const v5ExperimentalFunctions = (): RootFunctions => {
  const v2 = v2Functions()
  return {
    load(): void {
      v2.load()
      v5BootLoader.load()
    },

    loop(): void {
      v2.loop()

      const v5Interface: unknown = {}
      v5BootLoader.run(v5Interface);
      (Game as unknown as {v5: unknown}).v5 = v5Interface
    },
  }
}

const v2Functions = (): RootFunctions => {
  return {
    load(): void {
      initializeMemory()
    },

    loop(): void {
      Game.io = standardInput
      Game.v3 = {
        io: standardInput,
      }

      ErrorMapper.wrapLoop(() => {
        initializerTick()
      }, "initializerTick")()

      ErrorMapper.wrapLoop((): void => {
        if (isRespawned() === true) {
          resetOldSpawnData()
        }
      }, "Respawn")()

      ErrorMapper.wrapLoop((): void => {
        OperatingSystem.os.run()
      }, "OS")()
    },
  }
}

