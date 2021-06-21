import { isConsoleCommand } from "../../../src/os/infrastructure/console_command/console_command"

test("isConsoleCommand", () => {
  expect(isConsoleCommand("help")).toBe(true)
  expect(isConsoleCommand("kill")).toBe(true)
  expect(isConsoleCommand("aaaa")).toBe(false)
})
