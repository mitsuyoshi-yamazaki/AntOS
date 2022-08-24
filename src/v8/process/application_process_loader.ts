import { ApplicationProcessLauncher } from "./application_process_launcher"
import { V8TestProcess, V8TestProcessState } from "./application/v8_test_process"
import { EconomyProcess, EconomyProcessState } from "./application/economy_process"
import { ApplicationProcessDecoder } from "./application_process_decoder"

/**
 * Circular Dependency回避のためApplication ProcessはApplicationProcessLauncherから起動する関係でimportされる口がなくなってしまうため
 */

export const loadApplicationProcesses = (): void => {
  ApplicationProcessLauncher.register("V8TestProcess", () => V8TestProcess.create())
  ApplicationProcessDecoder.register("V8TestProcess", state => V8TestProcess.decode(state as V8TestProcessState))

  ApplicationProcessLauncher.register("EconomyProcess", () => EconomyProcess.create())
  ApplicationProcessDecoder.register("EconomyProcess", state => EconomyProcess.decode(state as EconomyProcessState))
}
