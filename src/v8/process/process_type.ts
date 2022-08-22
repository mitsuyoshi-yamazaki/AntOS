import { MemoryIdentifierConverter  } from "../utility/memory_identifier_converter/memory_identifier_converter"

export const rootProcessId = "root" // TODO: 不要なら消す

const processTypes = [
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

const processTypeMap = {
  "0": "RootProcess" as const,
  "1": "V8TestProcess" as const,
}
export type CompressedProcessType = keyof typeof processTypeMap

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
