type Command = "launch"

export interface StandardInputCommand {
  readonly command: Command

  /** @throws */
  run(args: string[]): string
}
