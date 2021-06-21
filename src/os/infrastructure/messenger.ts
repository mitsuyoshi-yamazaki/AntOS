import { OperatingSystem } from "os/os"

export interface MessengerMemory {
  i: string | null  // processId
  m: unknown        // message
}

export interface MessageObserver {
  didReceiveMessage(message: unknown): void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
function isMessageObserver(arg: any): arg is MessageObserver {
  return arg.didReceiveMessage !== undefined
}

export class Messenger {
  public constructor() {
    this.setupMemory()
  }

  public run(): void {
    if (Memory.messenger.i == null) {
      return
    }
    const processId = parseInt(Memory.messenger.i, 10)
    const process = OperatingSystem.os.processOf(processId)
    if (process == null) {
      console.log(`MessengerProcess invalid process ID ${processId}`)
    } else if (isMessageObserver(process)) {
      process.didReceiveMessage(Memory.messenger.m)
    } else {
      console.log(`MessengerProcess process ${process.constructor.name} is not MessageObserver`)
    }
    this.clearMemory()
  }

  // ---- Setup ---- //
  private setupMemory(): void {
    if (Memory.messenger == null) {
      this.clearMemory()
    }
  }

  private clearMemory(): void {
    Memory.messenger = {
      i: null,
      m: null,
    }
  }
}
