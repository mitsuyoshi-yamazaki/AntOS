import { EnvironmentName } from "./environment"

/**
# EnvironmentVariable
## 概要
- リテラルとしての環境変数
- 環境変数の読み込み、操作を行うのはSystemCallのEnvironmentVariable
 */

type EnvironmentVariable {
}

export const EnvironmentVariables: { [Key in EnvironmentName]: EnvironmentVariable } = {
  mmo: {},
  sim: {},
  swc: {},
  botarena: {},
  private: {},
  mockSeason: {},
  unknown: {},
}
