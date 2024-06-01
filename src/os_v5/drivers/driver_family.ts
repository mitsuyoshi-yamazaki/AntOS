/**
# DriverFamily
## 概要
- 環境ごとのDriverをまとめて、それ自体もDriverとして扱えるようにしたもの
 */

import { Environment } from "utility/environment"
import { Driver } from "../driver"

export interface DriverFamily extends Driver {
  readonly environment: Environment
}
