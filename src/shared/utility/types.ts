export type Mutable<T> = {
  -readonly [P in keyof T]: T[P]
}

export type ElementType<T> = T extends (infer U)[] ? U : never;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IsUnion<T, U = T> = T extends any
  ? [U] extends [T]
  ? false : true
  : never

export type NotUnion<T> = IsUnion<T> extends true ? never : T
