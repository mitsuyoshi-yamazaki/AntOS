// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EmptySerializable = { [K in keyof any]?: never }

export type SerializablePrimitiveType = string | number | boolean | null | undefined
export type SerializableArray = AnySerializable[]
export type SerializableObject = { [Key: string | number]: AnySerializable }
export type AnySerializable = SerializablePrimitiveType | SerializableArray | SerializableObject | EmptySerializable


// ---- Describe ---- //
export const describeSerializableObject = (obj: SerializableObject | null): string => {
  if (obj == null) {
    return "- null"
  }
  return getObjectDescription(obj, 0)
}
export const describeSerializableArray = (array: SerializableArray | null): string => {
  if (array == null) {
    return "- null"
  }
  return getArrayDescription(array, 0)
}


const spaces = "                                                  " // 50 spaces
const getIndent = (indent: number): string => spaces.slice(0, indent * 2)

const sortIndex = (value: AnySerializable): number => {
  if (value instanceof Array) {
    return 2
  } else if (typeof (value) === "object") {
    return 1
  } else {
    return 0
  }
}

const sortedKeys = (obj: SerializableObject): string[] => {
  return Object.keys(obj).sort((lhs, rhs) => sortIndex(obj[lhs]) - sortIndex(obj[rhs]))
}

const getObjectDescription = (obj: SerializableObject, indent: number): string => {
  const results: string[] = [
    "{",
  ]
  sortedKeys(obj).forEach(key => {
    const value = obj[key]
    if (value == null) {
      results.push(`${getIndent(indent)}- ${key}: null`)
    } else if (value instanceof Array) {
      if (value.length <= 0) {
        results.push(`${getIndent(indent)}- ${key}: []`)
      } else {
        results.push(`${getIndent(indent)}- ${key}: ${getArrayDescription(value, indent + 1)}`)
      }
    } else if (typeof (value) === "object") { // typeof (null) == "object"
      results.push(`${getIndent(indent)}- ${key}: ${getObjectDescription(value, indent + 1)}`)
    } else {
      results.push(`${getIndent(indent)}- ${key}: ${value}`)
    }
  })

  results.push(`${getIndent(indent)}}`)
  return results.join("\n")
}

const getArrayDescription = (array: SerializableArray, indent: number): string => {
  const isPrimitiveValues = array.every(value => typeof value !== "object")
  if (isPrimitiveValues === true) {
    return `[${array.map(value => `${value}`).join(",")}]`
  }

  const results: string[] = [
    "[",
  ]
  array.forEach(value => {
    if (value == null) {
      results.push(`${getIndent(indent)}- null`)
    } else if (value instanceof Array) {
      if (value.length <= 0) {
        results.push(`${getIndent(indent)}- []`)
      } else {
        results.push(`${getIndent(indent)}- ${getArrayDescription(value, indent + 1)}`)
      }
    } else if (typeof (value) === "object") {
      results.push(`${getIndent(indent)}- {`)
      results.push(getObjectDescription(value, indent + 1))
      results.push(`${getIndent(indent)}}`)
    } else {
      results.push(`${getIndent(indent)}- ${value}`)
    }
  })

  results.push(`${getIndent(indent)}]`)

  return results.join("\n")
}
