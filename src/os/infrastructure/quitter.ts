import { OperatingSystem } from "os/os"

export interface QuitterProcessMemory {
  i?: string  // processId
}

export class QuitterProcess {
  public constructor() {
    this.setupMemory()
  }

  public run(): void {
    if (Memory.quitter.i == null) {
      return
    }
    const processId = parseInt(Memory.quitter.i, 10)
    if (isNaN(processId)) {
      console.log(`QuitterProcess invalid process ID: ${Memory.quitter.i}`)
    } else {
      OperatingSystem.os.killProcess(processId)
    }
    delete Memory.quitter.i
  }

  // ---- Setup ---- //
  private setupMemory(): void {
    if (Memory.quitter == null) {
      Memory.quitter = {}
    }
  }
}
