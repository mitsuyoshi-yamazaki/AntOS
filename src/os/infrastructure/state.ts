export interface State {
  /** type identifier */
  t: string
}

export interface Stateful {
  encode(): State
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isStateful(arg: any): arg is Stateful {
  return arg.encode !== undefined
}

export interface StatefulType<T extends Stateful> {
  decode(state: State): T | null
}

export function numberValueFor<S extends State>(key: keyof S, state: S): number | null {
  const value = state[key]
  if (typeof (value) === "number") {
    return value
  }
  return null
}

export function stringValueFor<S extends State>(key: keyof S, state: S): string | null {
  const value = state[key]
  if (typeof (value) === "string") {
    return value
  }
  return null
}
