import { Cpu, CpuLog } from "shared/bios_function/functions/cpu"
import { EmptySerializable } from "shared/utility/serializable_types"
import { SystemCall } from "../system_call"

export type { CpuLog }


type SystemInfo = {
  getCpuUsageLog(): CpuLog[]
}

export const SystemInfo: SystemCall<"SystemInfo", EmptySerializable> & SystemInfo = {
  name: "SystemInfo",
  [Symbol.toStringTag]: "SystemInfo",

  load(): void {
  },

  startOfTick(): void {
  },

  endOfTick(): EmptySerializable {
    return {}
  },

  // SystemInfo
  getCpuUsageLog(): CpuLog[] {
    return Cpu.getCpuUsageLog()
  },
}
