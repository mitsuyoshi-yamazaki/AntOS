// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EmptySerializable = { [K in keyof any]?: never }

export type SerializablePrimitiveType = string | number | boolean | null | undefined
export type SerializableArray = AnySerializable[]
export type SerializableObject = { [Key: string | number]: AnySerializable }
export type AnySerializable = SerializablePrimitiveType | SerializableArray | SerializableObject | EmptySerializable
