import { ListArguments } from "shared/utility/argument_parser/list_argument_parser"

/** @throws */
export function execMemorySerializationCommand(args: string[]): string {
  const commandList = ["help", "test", "show", "set", "reset"]
  const command = args.shift()

  switch (command) {
  case "help":
    return `Commands: ${commandList}`

  case "test": {
    const listArguments = new ListArguments(args)
    const value = listArguments.boolean(0, "value").parse()
    const oldValue = Memory.skipSerialization.test
    Memory.skipSerialization.test = value

    return `[TEST] Memory.skipSerialization.test ${oldValue} =&gt ${value}`
  }

  case "show":
    return `Memory serialization\n${getStatus()}`

  case "set":
    return setValue(args)

  case "reset":
    return resetValue(args)

  default:
    throw `Invalid command ${command}. see "help"`
  }
}

/** @throws */
const resetValue = (args: string[]): string => {
  const listArguments = new ListArguments(args)
  const parameter = listArguments.string(0, "parameter").parse()
  const previousStatus = getStatus()

  switch (parameter) {
  case "duration":
    Memory.skipSerialization.by = null
    break

  case "interval":
    Memory.skipSerialization.interval = null
    break

  default:
    throw `invalid parameter ${parameter}. specify: duration, interval`
  }

  return `${previousStatus}\n=&gt\n${getStatus()}`

}

/** @throws */
const setValue = (args: string[]): string => {
  const listArguments = new ListArguments(args)
  const parameter = listArguments.string(0, "parameter").parse()
  const value = listArguments.int(1, "value").parse({min: 1})
  const previousStatus = getStatus()

  switch (parameter) {
  case "duration":
    Memory.skipSerialization.by = Game.time + value
    break

  case "interval":
    Memory.skipSerialization.interval = value
    break

  default:
    throw `invalid parameter ${parameter}. specify: duration, interval`
  }

  return `${previousStatus}\n=&gt\n${getStatus()}`
}

const getStatus = (): string => {
  return [
    `- by: ${Memory.skipSerialization.by}`,
    `- interval: ${Memory.skipSerialization.interval}`,
    `- test: ${Memory.skipSerialization.test}`,
  ].join("\n")
}
