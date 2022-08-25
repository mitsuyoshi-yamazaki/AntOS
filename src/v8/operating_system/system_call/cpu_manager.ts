import { SystemCall } from "../system_call";

interface CpuManagerInterface extends SystemCall {
  measure(fn: () => void): number
}

/// Screepsの機能だが実行に必須のためSystemCall
export const CpuManager: CpuManagerInterface = {
  measure(fn: () => void): number {
    const cpu = Game.cpu.getUsed()
    fn()
    return Game.cpu.getUsed() - cpu
  },
}
