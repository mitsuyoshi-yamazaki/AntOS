import { MemoryIdentifierConverter  } from "../utility/memory_identifier_converter/memory_identifier_converter"

export const rootProcessId = "root"

export const processTypes = [
  "RootProcess",
  "V8TestProcess",
] as const
export type ProcessType = typeof processTypes[number]

export const isProcessType = (arg: string): arg is ProcessType => {
  if ((processTypes as readonly string[]).includes(arg) !== true) {
    return false
  }
  return true
}

export type ShortV8TestProcessType = "a"

const shortV8TestProcessType: ShortV8TestProcessType = "a"

export const compressedProcessTypes = [
  shortV8TestProcessType,
] as const
export type CompressedProcessType = typeof compressedProcessTypes[number]

const processTypeMap: { [Key in CompressedProcessType]: ProcessType } = {
  a: "V8TestProcess",
}

const processTypeReverseMap: { [Key in ProcessType]: CompressedProcessType } = (() => {
  const obj: {[Key: string]: string} = {}
  Array.from(Object.entries(processTypeMap)).forEach(([compressedProcessType, processType]) => {
    obj[processType] = compressedProcessType
  })
  return obj as { [Key in ProcessType]: CompressedProcessType }
})()

export const ProcessTypeConverter: MemoryIdentifierConverter<ProcessType, CompressedProcessType> = {
  convert(processType: ProcessType): CompressedProcessType {
    return processTypeReverseMap[processType]
  },

  revert(compressedProcessType: CompressedProcessType): ProcessType {
    return processTypeMap[compressedProcessType]
  },
}
