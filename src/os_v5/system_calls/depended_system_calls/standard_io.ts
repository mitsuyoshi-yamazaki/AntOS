import { SystemCall } from "../../system_call"

type StandardIO = {
  io(input: string): string
}

export const StandardIO: SystemCall & StandardIO = {
  name: "StandardIO",

  load(): void {
  },

  startOfTick(): void {
  },

  endOfTick(): void {
  },

  io(input: string): string {
    return `input: ${input}`  // TODO:
  },
}
