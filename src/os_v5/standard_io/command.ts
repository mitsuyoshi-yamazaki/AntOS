export type Command = {
  readonly command: string

  /** @throws */
  help(args: string[]): string

  /** @throws */
  run(args: string[]): string
}
