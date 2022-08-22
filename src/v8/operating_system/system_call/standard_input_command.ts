export interface StandardInputCommand {
  readonly description: string

  /** @throws */
  run(args: string[]): string
}
