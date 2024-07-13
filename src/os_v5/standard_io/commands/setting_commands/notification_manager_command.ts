import { Command, runCommands } from "os_v5/standard_io/command"
import { NotificationManager, NotificationManagerAccessor } from "os_v5/system_calls/depended_system_calls/notification_manager"
import { NotificationManagerTestNotification } from "os_v5/system_calls/depended_system_calls/notification_manager_types"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"


const SendTestNotificationCommand: Command = {
  command: "test",

  help(): string {
    return "test {test message}"
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string {
    const testMessage = argumentParser.string([0, "test message"]).parse()
    const notification: NotificationManagerTestNotification = {
      eventName: "nm_test",
      message: testMessage,
    }

    NotificationManager.send(notification)

    return `Test notification sent with "${testMessage}"`
  },
}

const ShowCommand: Command = {
  command: "show",

  help(): string {
    return "show"
  },

  /** @throws */
  run(): string {
    const observersByEventNames = NotificationManagerAccessor.getRegisteredObservers()

    return Array.from(observersByEventNames.entries()).map(([eventName, observers]) => `- ${eventName}: ${observers.length} observers`).join("\n")
  },
}


const commandRunners: Command[] = [
  ShowCommand,
  SendTestNotificationCommand,
]

export const NotificationManagerCommand: Command = {
  command: "notification",

  help(): string {
    return "notification {setting} {...args}"
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string {
    return runCommands(argumentParser, commandRunners)
  },
}
