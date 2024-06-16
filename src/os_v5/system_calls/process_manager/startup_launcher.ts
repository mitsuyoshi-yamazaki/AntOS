import { EmptySerializable } from "os_v5/utility/types"
import { SystemCall } from "../../system_call"

/**
# StartupLauncher
## 概要
- アプリケーションプロセスを自動で起動

## 仕様
- 環境変数から実行環境を読み取り、ルートアプリケーションを起動する
 */

// eslint-disable-next-line @typescript-eslint/ban-types
type StartupLauncher = {
}

export const StartupLauncher: SystemCall<"StartupLauncher", EmptySerializable> & StartupLauncher = {
  name: "StartupLauncher",
  [Symbol.toStringTag]: "StartupLauncher",

  load(): void {
  },

  startOfTick(): void {
  },

  endOfTick(): EmptySerializable {
    return {}
  },
}
