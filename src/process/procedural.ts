export interface Procedural {
  runBeforeTick?(): void
  runOnTick(): void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isProcedural(arg: any): arg is Procedural {
  return arg.runOnTick !== undefined
}
