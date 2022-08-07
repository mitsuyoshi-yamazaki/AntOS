type Command = "launch" | "process"

export interface StandardInputCommand {
  readonly command: Command

  /** @throws */
  run(args: string[]): string
}
