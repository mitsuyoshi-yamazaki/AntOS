import { StandardInputCommand } from "../standard_input_command"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { ArgumentParser } from "shared/utility/argument_parser/argument_parser"
import { MessageObserver } from "v8/operating_system/message_observer"
import { SystemCall } from "v8/operating_system/system_call"

const TabSize = ConsoleUtility.TabSize

export type DriverInfoAccessor = {
  listDriverInfo(): Map<string, [string, string][]> // <driver family name, [driver identifier, driver description]>
  getDriver(driverIdentifier: string): (SystemCall & MessageObserver) | null
}

export class DriverCommand implements StandardInputCommand {
  public get description(): string {
    const descriptions: string[] = [
      "# driver command",
      "- &ltdriver identifier&gt &ltcommand&gt",
      "- list_drivers",
      "  - list all registered driver identifiers",
    ]

    return descriptions.join("\n")
  }

  public constructor(
    private readonly driverAccessor: DriverInfoAccessor,  // StandardInputCommandのロード後にDriverがロードされるため
  ) { }

  public run(args: string[]): string {
    try {
      const localCommand = args.shift()
      if (localCommand == null) {
        throw "no driver identifier or command"
      }
      switch (localCommand) {
      case "list_drivers":
        return this.listDrivers()
      default:
        break
      }

      const driverIdentifier = localCommand
      const driver = this.driverAccessor.getDriver(driverIdentifier)
      if (driver == null) {
        throw `no driver with identifier ${driverIdentifier}`
      }

      const argumentParser = new ArgumentParser(args)
      return driver.didReceiveMessage(argumentParser)

    } catch (error) {
      return `${ConsoleUtility.colored("[Error]", "error")} ${error}`
    }
  }

  private listDrivers(): string {
    return Array.from(this.driverAccessor.listDriverInfo().entries())
      .flatMap(([driverFamilyName, driverInfo]): string[] => {
        const results: string[] = [
          `- ${driverFamilyName}`,
          ...driverInfo.map(([driverIdentifiers, description]) => `  - ${ConsoleUtility.tab(driverIdentifiers, TabSize.medium)}: ${description}`)
        ]

        return results
      })
      .join("\n")
  }
}
