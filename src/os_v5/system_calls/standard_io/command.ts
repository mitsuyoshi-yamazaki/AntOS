export type Command = {
  /** @throws */
  help(args: string[]): string

  /** @throws */
  run(args: string[]): string
}
