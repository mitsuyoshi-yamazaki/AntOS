import { Command, runCommands } from "../../command"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"


const tab = ConsoleUtility.tab
const TabSize = ConsoleUtility.TabSize


export const TestCommand: Command = {
  command: "test",

  help(): string {
    return "test {test subject} {...args}"
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string {
    return runCommands(argumentParser, [
      ArgumentParserCommand,
    ])
  },
}


const argumentParserArgumentTypes = ["string", "int", "process"] as const
type ArgumentParserArgumentType = typeof argumentParserArgumentTypes[number]
const isArgumentParserArgumentType = (arg: string): arg is ArgumentParserArgumentType => (argumentParserArgumentTypes as Readonly<string[]>).includes(arg)


const ArgumentParserCommand: Command = {
  command: "parser",

  help(): string {
    return "parser {argument type} {...argument list of the type}"
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string {
    const alignedValueDescription = (value: string, valueType: string): string => {
      return `${tab(valueType, TabSize.large)} ${value}`
    }

    const argumentType = argumentParser.typedString([0, "argument type"], "ArgumentParserArgumentType", isArgumentParserArgumentType, { choices: argumentParserArgumentTypes }).parse()

    const values = argumentParser.list([1, "values"], argumentType).parse()
    const valueDescriptions = values.map((value): string => {
      const valueType = typeof value
      if (valueType !== "object") {
        return alignedValueDescription(`${value}`, valueType)
      }
      // eslint-disable-next-line @typescript-eslint/ban-types
      return alignedValueDescription(`${value}`, (value as Object).constructor.name)
    })

    return [
      alignedValueDescription("type", "value"),
      ...valueDescriptions,
    ].join("\n")  },
}
