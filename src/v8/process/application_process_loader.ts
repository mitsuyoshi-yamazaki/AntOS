import { ApplicationProcessLauncher } from "./application_process_launcher"
import { V8TestProcess } from "./application/v8_test_process"
import { EconomyProcess } from "./application/economy_process"

/**
 * Circular Dependency回避のためApplication ProcessはApplicationProcessLauncherから起動する関係でimportされる口がなくなってしまうため
 */

export const loadApplicationProcesses = (): void => {
  ApplicationProcessLauncher.register("V8TestProcess", () => V8TestProcess.create())
  ApplicationProcessLauncher.register("EconomyProcess", () => EconomyProcess.create())
}
