import { SystemInfo } from "utility/system_info"

export const Sign = {
  sign(room: Room): string {
    if (room.controller == null) {
      return ""
    }
    if (room.controller.my === true) {
      return this.signForOwnedRoom()
    } else {
      return `at ${Game.time}`
    }
  },

  signForOwnedRoom(): string {
    return `v${SystemInfo.application.version} at ${Game.time}`
  },

  signForHostileRoom(): string {
    return "🍣"
  },

  signForGclFarm(): string {
    return `GCL Farm v${SystemInfo.application.version} at ${Game.time}`
  }
}
