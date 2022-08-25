/**
 # loadApplicationProcesses
 ## 必要性
 Circular Dependency回避のため、ProcessがProcessManagerをimportする方向に依存させる必要がある
 しかしProcess起動をキックするのはProcessManager側であるため、その依存を切るため最上位Process（Application Process）の起動・デコード処理をここにまとめる
 */

import { ApplicationProcessLauncher } from "./application_process_launcher"
import { V8TestProcess, V8TestProcessState } from "./application/v8_test_process"
import { EconomyProcess, EconomyProcessState } from "./application/economy_process"
import { ApplicationProcessDecoder } from "./application_process_decoder"

export const loadApplicationProcesses = (): void => {
  ApplicationProcessLauncher.register("V8TestProcess", () => V8TestProcess.create())
  ApplicationProcessDecoder.register("V8TestProcess", state => V8TestProcess.decode(state as V8TestProcessState))

  ApplicationProcessLauncher.register("EconomyProcess", () => EconomyProcess.create())
  ApplicationProcessDecoder.register("EconomyProcess", state => EconomyProcess.decode(state as EconomyProcessState))
}
