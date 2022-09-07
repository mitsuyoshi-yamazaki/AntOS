/**
 # Environmental Variables
 ## 概要
 環境依存変数
 BootLoaderより先に実行される必要があるため別ファイルとなっている。 `boot_loader.ts` の説明を参照
 */

import { KernelMemory, ProcessManagerMemory } from "./kernel_memory"

// EnvironmentalVariable読み込み時に必要なため
if (Memory.v3 == null) {
  Memory.v3 = {
    enabled: false,
    process: {
      processIdIndex: 0,
      processInfoMemories: [],
    },
  }
}

export const EnvironmentalVariables = {
  getKernelMemory(): KernelMemory {
    return Memory.v3  // Memoryオブジェクトの参照はtick毎変化するためキャッシュしない
  },

  getProcessManagerMemory(): ProcessManagerMemory {
    return Memory.v3.process
  },
}
