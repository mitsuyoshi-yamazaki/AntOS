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

export const BootLoader = {
  load(): void {
    registerDrivers()
  },
}

/// Driverの呼び出し順は依存があるためここ一箇所で登録する
const registerDrivers = (): void => {
  // TODO:
}
