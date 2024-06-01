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

// ---- v3 OS ---- //
// import { BootLoader as V3BootLoader } from "v8/operating_system/boot_loader"
// import { Kernel } from "v8/operating_system/kernel"

// ---- v4 OS ---- //
// import { bootLoader as v4BootLoader } from "os_v4/boot_loader"

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
    case "botarena":
    case "persistent world":
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

const v5ExperimentalFunctions = (): RootFunctions => {
  const v2 = v2Functions()
  return {
    load(): void {
      v2.load()
      v5BootLoader.load()
    },

    loop(): void {
      v2.loop()
      v5BootLoader.run()
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

// const v3Functions = (): RootFunctions => {
//   return {
//     load(): void {
//       V3BootLoader.load()
//     },

//     loop(): void {
//       Game.io = V3BootLoader.io

//       // ErrorMapper.wrapLoop(() => {
//       //   initializerTick()
//       // }, "initializerTick")()

//       // TODO: Respawn対応

//       ErrorMapper.wrapLoop((): void => {
//         Kernel.run()
//       })()
//     },
//   }
// }
