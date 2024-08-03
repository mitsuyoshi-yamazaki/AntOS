import { Mutable } from "shared/utility/types"
import { BiosFunction } from "../bios_function"

type CpuLog = {
  readonly getUsed: number
  readonly bucket: number
}

type CpuMemory = {
  readonly logs: CpuLog[]
}

const initializeMemory = (memory: CpuMemory): CpuMemory => {
  const mutableMemroy = memory as Mutable<CpuMemory>

  if (mutableMemroy.logs == null) {
    mutableMemroy.logs = []
  }

  return mutableMemroy
}


type Cpu = {
  getCpuUsageLog(): CpuLog[]
}


const maxCpuLogCount = 20
let cpuMemory: CpuMemory = {} as CpuMemory


export const Cpu: BiosFunction<"Cpu", CpuMemory> & Cpu = {
  name: "Cpu",
  [Symbol.toStringTag]: "Cpu",

  load(memory: CpuMemory): void {
    cpuMemory = initializeMemory(memory)
  },

  startOfTick(): void {
  },

  /// CPU使用量を記録するため、他の全ての処理が終わった後に呼び出す必要がある
  endOfTick(): CpuMemory {
    cpuMemory.logs.push({
      getUsed: Game.cpu.getUsed(),
      bucket: Game.cpu.bucket,
    })

    const exceededLogCount = cpuMemory.logs.length - maxCpuLogCount
    if (exceededLogCount > 0) {
      cpuMemory.logs.splice(0, exceededLogCount)
    }

    return cpuMemory
  },


  // Cpu
  getCpuUsageLog(): CpuLog[] {
    return [...cpuMemory.logs]
  },
}
