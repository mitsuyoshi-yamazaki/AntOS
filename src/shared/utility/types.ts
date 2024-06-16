export type Mutable<T> = {
  -readonly [P in keyof T]: T[P]
}

export type ElementType<T> = T extends (infer U)[] ? U : never;
