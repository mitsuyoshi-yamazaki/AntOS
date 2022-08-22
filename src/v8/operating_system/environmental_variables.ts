/**
 # Environmental Variables
 ## 概要
 環境依存変数
 BootLoaderより先に実行される必要があるため別ファイルとなっている。 `boot_loader.ts` の説明を参照
 */

import { KernelMemory } from "./kernel_memory"

type EnvironmentalVariablesInterface = {
  kernelMemory: KernelMemory
}

if (Memory.v3 == null) {
  Memory.v3 = {
    enabled: false,
    process: {
      processIdIndex: 0,
      processInfoMemories: {},
    },
  }
}

export const EnvironmentalVariables: EnvironmentalVariablesInterface = {
  kernelMemory: Memory.v3,
}
