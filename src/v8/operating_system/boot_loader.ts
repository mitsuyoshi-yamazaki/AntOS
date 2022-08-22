/**
 # BootLoader
 ## 概要
 Kernelをプラットフォームから独立させるために、その仲介を行う

 ## 動作
 - Kernelの初期化を行う
   - 永続化に使用するメモリ領域ををkernelに引き渡す★
   - Driverをkernelに登録する

 ## 実装
 `BootLoader` の初期化は `Kernel` の初期化後に実行されるため、 `Kernel` 初期化時に存在する必要のある★項目は `environmental_variables.ts` に実装する
 */

import type { Driver } from "./driver"
import { Kernel } from "./kernel"

export const BootLoader = {
  load(): void {
    const drivers: Driver[] = [
    ]
    Kernel.registerDrivers(drivers)
    Kernel.load()
  },
}
