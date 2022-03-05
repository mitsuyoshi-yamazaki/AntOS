import "ts-polyfill/lib/es2019-array"

import { ErrorMapper } from "error_mapper/ErrorMapper"
import { memhack } from "./memory_hack"
// import * as ScreepsProfiler from "screeps-profiler" // Game.profiler.profile(ticks)

import { init as initializerInit, tick as initializerTick } from "_old/init"
import { leveled_colored_text } from "./utility"
import { OperatingSystem } from "os/os"
import { SystemInfo } from "utility/system_info"
import { isRespawned, resetOldSpawnData } from "script/respawn"
import { BootLoader } from "v8/operating_system/boot_loader"
import { Environment } from "utility/environment"

memhack.load()

initializerInit()
const initializing_message = `${SystemInfo.os.name} v${SystemInfo.os.version} - ${SystemInfo.application.name} v${SystemInfo.application.version} reboot in ${Game.shard.name} at ${Game.time}`
console.log(leveled_colored_text(initializing_message, "warn"))

const mainLoop = () => {
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

  if (Environment.shard === "shard3") { // TODO:
    ErrorMapper.wrapLoop((): void => {
      const v8Kernel = BootLoader.loadKernel()
      v8Kernel.run()
    }, "v8 OS")()
  }

  const all_cpu = Math.ceil(Game.cpu.getUsed())
  Memory.cpu_usages.push(all_cpu)
}

// ScreepsProfiler.enable()  // TODO: 普段はオフに

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  memhack.beforeTick()
  // ScreepsProfiler.wrap(mainLoop)
  mainLoop()
  memhack.afterTick()
}, "Main")

/**
 * 2 3 5 7 11 13 17 19 23 29 31 37 41 43 47 53 59 61 67 71 73 79 83 89 97 101 103 107 109 113 127 131 137 139 149 151 157 163 167 173 179 181 191 193 197 199 211 223 227 229 233 239 241 251 257 263 269 271 277 281 283 293 307 311 313 317 331 337 347 349 353 359 367 373 379 383 389 397 401 409 419 421 431 433 439 443 449 457 461 463 467 479 487 491 499 503 509 521 523 541 547 557 563 569 571 577 587 593 599 601 607 613 617 619 631 641 643 647 653 659 661 673 677 683 691 701 709 719 727 733 739 743 751 757 761 769 773 787 797 809 811 821 823 827 829 839 853 857 859 863 877 881 883 887 907 911 919 929 937 941 947 953 967 971 977 983 991 997
 * 1511 2099 4099 10009
 */
