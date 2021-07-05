import { SystemInfo } from "utility/system_info"

export const Sign = {
  sign: function (room: Room): string {
    if (room.controller == null) {
      return ""
    }
    if (room.controller.my === true) {
      return `v${SystemInfo.application.version} at ${Game.time}`
    } else {
      return `at ${Game.time}`
    }
  }
}
