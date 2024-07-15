import { Command, runCommands } from "../../command"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { ProcessManager } from "os_v5/system_calls/process_manager/process_manager"
import { OnHeapContinuousTaskProcess, OnHeapContinuousTaskProcessId } from "os_v5/processes/support/on_heap_continuous_task_process"
import { Timestamp } from "shared/utility/timestamp"
import { Logger } from "os_v5/system_calls/logger"


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
      ContinuousTaskTestCommand,
    ])
  },
}


// OnHeapContinuousTaskProcess
const ContinuousTaskTestCommand: Command = {
  command: "continuous_task",

  help(): string {
    return "continuous_task duration={duration}"
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string {
    const duration = argumentParser.int("duration").parse({ min: 1, max: 100 })
    const task = (ticksPassed: Timestamp) => {
      console.log(`OnHeapContinuousTask test: ${Game.time} at ${ticksPassed}`)
    }

    const process = ProcessManager.addProcess((processId: OnHeapContinuousTaskProcessId) => {
      return OnHeapContinuousTaskProcess.create(processId, "Test", "system", duration, task)
    })

    Logger.setLogEnabledFor([process.processId], duration + 1)

    return `Launched ${process}`
  },
}


// ArgumentParserCommand
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
