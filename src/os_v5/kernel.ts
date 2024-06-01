import { SystemCall } from "./system_call"
import { systemCallLifecycles } from "./system_calls/interface"
import { Driver } from "./driver"
import { DriverFamily } from "./drivers/driver_family"

type KernelMemory = {}

const reversedSystemCallLifecycles = [...systemCallLifecycles].reverse()

export const Kernel = {
  load(): void {
    // TODO: メモリ初期化

    systemCallLifecycles.forEach(systemCall => systemCall.load())
  },

  startOfTick(): void {
    systemCallLifecycles.forEach(systemCall => systemCall.startOfTick())
  },

  endOfTick(): void {
    reversedSystemCallLifecycles.forEach(systemCall => systemCall.endOfTick())
  },

  run(): void {
  },

  systemInfo(): string {
    return "TODO: OSのスペック、SystemCallやDriverの内容を返す"
  },
}
