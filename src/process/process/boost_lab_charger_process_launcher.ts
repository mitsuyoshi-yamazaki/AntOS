import type { Process } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"

export type BoostLabChargerProcessType = Process & {
  readonly parentRoomName: RoomName
}

type Launcher = {
  readonly getRunningProcess: (roomName: RoomName) => BoostLabChargerProcessType | null
  readonly launch: (roomName: RoomName) => BoostLabChargerProcessType | null  // nullableなのは内部的にSystemCallを呼び出しているため
}
let launcher: Launcher | null = null

export const BoostLabChargerProcessLauncher = {
  load(l: Launcher): void {
    launcher = l
  },

  launcher(): Launcher | null {
    return launcher
  },
}
