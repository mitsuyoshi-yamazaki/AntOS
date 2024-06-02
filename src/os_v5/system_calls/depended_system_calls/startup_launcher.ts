import { SystemCall } from "../../system_call"

type StartupLauncher = {
}

export const StartupLauncher: SystemCall & StartupLauncher = {
  name: "StartupLauncher",

  load(): void {
  },

  startOfTick(): void {
  },

  endOfTick(): void {
  },
}
