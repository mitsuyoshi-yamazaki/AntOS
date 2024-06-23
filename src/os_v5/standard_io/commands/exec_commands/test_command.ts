import { Command } from "../../command"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"


const tab = ConsoleUtility.tab
const TabSize = ConsoleUtility.TabSize


const testTypes = ["parser"] as const
type TestType = typeof testTypes[number]
const isTestType = (arg: string): arg is TestType => (testTypes as Readonly<string[]>).includes(arg)


export const TestCommand: Command = {
  command: "test",

  /** @throws */
  help(): string {
    return "> exec test "
  },

  /** @throws */
  run(args: string[]): string {
    const argumentParser = new ArgumentParser(args)
    const testType = argumentParser.typedString(0, "TestType", isTestType, {choices: testTypes}).parse()

    switch (testType) {
    case "parser":
      args.shift()
      return testArgumentParser(new ArgumentParser(args))
    }
  },
}


const argumentParserArgumentTypes = ["string", "int"] as const
type ArgumentParserArgumentType = typeof argumentParserArgumentTypes[number]
const isArgumentParserArgumentType = (arg: string): arg is ArgumentParserArgumentType => (argumentParserArgumentTypes as Readonly<string[]>).includes(arg)


/** @throws */
const testArgumentParser = (argumentParser: ArgumentParser): string => {
  const alignedValueDescription = (value: string, valueType: string): string => {
    return `${tab(value, TabSize.small)}${tab(valueType, TabSize.veryLarge)}`
  }

  const argumentType = argumentParser.typedString(0, "ArgumentParserArgumentType", isArgumentParserArgumentType, {choices: argumentParserArgumentTypes}).parse()

  const values = argumentParser.list(1, argumentType).parse()
  const valueDescriptions = values.map((value): string => {
    const valueType = typeof value
    if (valueType === "object") {
      // eslint-disable-next-line @typescript-eslint/ban-types
      return alignedValueDescription(`${value}`, (value as Object).constructor.name)
    }
    return alignedValueDescription(`${value}`, valueType)
  })

  return [
    alignedValueDescription("value", "type"),
    ...valueDescriptions,
  ].join("\n")
}
