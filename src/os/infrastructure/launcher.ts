import { OperatingSystem } from "os/os"
import { ScoutCreepProcess } from "process/test/scout_creep"

export interface LauncherProcessMemory {
  "c.s"?: string  // creep.ScoutCreepProcess
}

export class LauncherProcess {
  public constructor() {
    this.setupMemory()
  }

  public run(): void {
    if (typeof Memory.launcher["c.s"] === "string") {
      this.launchScoutCreep(Memory.launcher["c.s"])
      delete Memory.launcher["c.s"]
    }
  }

  // ---- Setup ---- //
  private setupMemory(): void {
    if (Memory.launcher == null) {
      Memory.launcher = {}
    }
  }

  // ---- Launch ---- //
  private launchScoutCreep(creepId: string): void {
    console.log(`Launcher: Launching ScoutCreep with ID: ${creepId}`)

    OperatingSystem.os.addProcess(processId => {
      return new ScoutCreepProcess(processId, creepId, [])
    })
  }
}
