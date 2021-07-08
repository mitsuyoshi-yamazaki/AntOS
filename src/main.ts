import "ts-polyfill/lib/es2019-array"

import { ErrorMapper } from "error_mapper/ErrorMapper"
import * as ScreepsProfiler from "screeps-profiler"

import { Empire } from "_old/empire"
import * as Initializer from "_old/init"
import { leveled_colored_text } from "./utility"
import { OperatingSystem } from "os/os"
import { roomLink } from "utility/log"
import { Migration } from "utility/migration"
import { ShortVersion, SystemInfo } from "utility/system_info"
import { RoomName } from "utility/room_name"

Initializer.init()
const initializing_message = `${SystemInfo.os.name} v${SystemInfo.os.version} - ${SystemInfo.application.name} v${SystemInfo.application.version} reboot in ${Game.shard.name} at ${Game.time}`
console.log(leveled_colored_text(initializing_message, "warn"))

/* eslint-disable */

const mainLoop = () => {
  if (Memory.debug.cpu.show_usage) {
    console.log(`\n\n--------------\n\n`)
  }

  ErrorMapper.wrapLoop(() => {
    Initializer.tick()
  }, `Initializer.tick`)()

  if (Game.shard.name === "shard2") {
    ErrorMapper.wrapLoop(() => {
      const owned_controllers: StructureController[] = []

      for (const room_name in Game.rooms) {
        const room = Game.rooms[room_name]
        if (!room || !room.controller || !room.controller.my) {
          continue
        }

        const controlVersion = Migration.roomVersion(room.name)
        if (controlVersion !== ShortVersion.v3) {
          continue
        }

        if (room.memory && room.memory.is_gcl_farm) {
          continue
        }

        owned_controllers.push(room.controller)
      }

      const empire = new Empire(Game.user.name, owned_controllers)

      empire.run()
    }, `empire.run`)()

    if ((Game.time % 997) == 17) {
      ErrorMapper.wrapLoop(() => {
        for (const squad_name in Memory.squads) {
          const squad_memory = Memory.squads[squad_name]
          const room = Game.rooms[squad_memory.owner_name]

          if (room && room.controller && room.controller.my) {
            continue
          }

          delete Memory.squads[squad_name]
        }
        console.log(`Main squads GC at ${Game.time}`)
      }, `Squads.gc`)()
    }

    const test_send_resources = Memory.debug.test_send_resources
    if (test_send_resources) {
      Memory.debug.test_send_resources = false
    }
  }

  if ((Game.time % 29) == 3) {
    ErrorMapper.wrapLoop(() => {
      for (const creep_name in Game.creeps) {
        const creep = Game.creeps[creep_name]

        creep.notifyWhenAttacked(false) // creepsは全て通知を停止
      }
      // console.log(`Main creeps GC at ${Game.time}`)
    }, `Creeps.gc`)()
  }

  /* eslint-enable */
  OperatingSystem.os.run()
  /* eslint-disable */

  const all_cpu = Math.ceil(Game.cpu.getUsed())
  Memory.cpu_usages.push(all_cpu)

  if ((all_cpu > Memory.debug.cpu.stop_threshold) && Memory.debug.cpu.show_usage) {
    Memory.debug.cpu.show_usage = false
  }
}

ScreepsProfiler.enable()  // TODO: 普段はオフに

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  ScreepsProfiler.wrap(mainLoop)
}, `Main`)

/**
 * 2 3 5 7 11 13 17 19 23 29 31 37 41 43 47 53 59 61 67 71 73 79 83 89 97 101 103 107 109 113 127 131 137 139 149 151 157 163 167 173 179 181 191 193 197 199 211 223 227 229 233 239 241 251 257 263 269 271 277 281 283 293 307 311 313 317 331 337 347 349 353 359 367 373 379 383 389 397 401 409 419 421 431 433 439 443 449 457 461 463 467 479 487 491 499 503 509 521 523 541 547 557 563 569 571 577 587 593 599 601 607 613 617 619 631 641 643 647 653 659 661 673 677 683 691 701 709 719 727 733 739 743 751 757 761 769 773 787 797 809 811 821 823 827 829 839 853 857 859 863 877 881 883 887 907 911 919 929 937 941 947 953 967 971 977 983 991 997
 * 1511 2099 4099 10009
 */
