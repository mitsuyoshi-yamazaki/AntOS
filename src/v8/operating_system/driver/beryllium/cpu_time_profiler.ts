/**
 # CpuTimeProfiler
 ## 概要
 */

import { SystemCall } from "../../system_call"

interface CpuTimeProfilerInterface extends SystemCall {
  measure(fn: () => void): number
}

export const CpuTimeProfiler: CpuTimeProfilerInterface = {
  measure(fn: () => void): number {
    const cpu = Game.cpu.getUsed()
    fn()
    return Game.cpu.getUsed() - cpu
  },
}
