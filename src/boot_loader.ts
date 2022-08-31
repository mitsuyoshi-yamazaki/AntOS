import { ErrorMapper } from "error_mapper/ErrorMapper"
import { OperatingSystem } from "os/os"
import { isRespawned, resetOldSpawnData } from "script/respawn"
import { tick as initializerTick } from "_old/init"
import { Environment } from "utility/environment"
import { BootLoader as V3BootLoader } from "v8/operating_system/boot_loader"
import { Kernel } from "v8/operating_system/kernel"

type RootFunctions = {
  load(): void
  loop(): void
}

export const BootLoader = {
  load(): RootFunctions {
    switch (Environment.world) {
    case "private":
      return v3Functions()
    case "botarena":
    case "persistent world":
    case "season 4":
    case "simulation":
    case "swc":
    case "unknown":
      return v2Functions()
    }
  }
}

const v2Functions = (): RootFunctions => {
  return {
    load(): void {
    },

    loop(): void {
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

const v3Functions = (): RootFunctions => {
  return {
    load(): void {
      V3BootLoader.load()
    },

    loop(): void {
      ErrorMapper.wrapLoop(() => {
        initializerTick()
      }, "initializerTick")()

      // TODO: Respawn対応

      ErrorMapper.wrapLoop((): void => {
        Kernel.run()
      })()
    },
  }
}
