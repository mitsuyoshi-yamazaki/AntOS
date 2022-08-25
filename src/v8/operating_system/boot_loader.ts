/**
 # BootLoader
 ## 概要
 Kernelをプラットフォームから独立させるために、その仲介を行う

 ## 動作
 - Kernelの初期化を行う
   - 永続化に使用するメモリ領域ををkernelに引き渡す★
   - Driverをkernelに登録する
 - Processを自動起動する場合はここで行う

 ## 実装
 `BootLoader` の初期化は `Kernel` の初期化後に実行されるため、 `Kernel` 初期化時に存在する必要のある★項目は `environmental_variables.ts` に実装する
 */

import type { Driver } from "./driver"
import { Kernel } from "./kernel"
import { loadApplicationProcesses } from "v8/process/application_process_loader"
// import { } from "./driver/traffic_driver"
// import { CpuTimeProfiler } from "./driver/cpu_time_profiler"
// import {  } from "./driver/hostile_creep_predictor"

export const BootLoader = {
  load(): void {
    loadApplicationProcesses()

    const drivers: Driver[] = [
    ]
    Kernel.registerDrivers(drivers)
    Kernel.load()
  },
}
