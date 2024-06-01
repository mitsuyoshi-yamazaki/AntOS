/**
# Driver
## 概要
- SystemCallのうち、環境（デプロイサーバー）に依存する処理
 */

import { SystemCall } from "./system_call"

export interface Driver extends SystemCall {
}
