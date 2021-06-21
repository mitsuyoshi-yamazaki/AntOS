import { OperatingSystem } from "os/os"
import { ScoutCreepProcess } from "process/test/scout_creep"
import {
  Process,
  ProcessId,
} from "../../process/process"

export interface LauncherProcessMemory {
  "c.s"?: string  // creep.ScoutCreepProcess
}

export class LauncherProcess implements Process {
  public readonly shouldStore = false

  public constructor(public readonly processId: ProcessId) {
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
