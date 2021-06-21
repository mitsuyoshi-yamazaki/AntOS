import { OperatingSystem } from "os/os"

export interface ProcessQuitterMemory {
  i?: string  // processId
}

export class ProcessQuitter {
  public constructor() {
    this.setupMemory()
  }

  public run(): void {
    if (Memory.quitter.i == null) {
      return
    }
    const processId = parseInt(Memory.quitter.i, 10)
    if (isNaN(processId)) {
      console.log(`ProcessQuitter invalid process ID: ${Memory.quitter.i}`)
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
