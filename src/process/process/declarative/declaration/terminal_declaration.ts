/**
 # TerminalDeclaration
 ## 概要
 Terminalネットワーク内の資源量を管理する

 ## 要件
 ### 全体

 ### 各Terminal
 - 常にEnergyがあること
   - 防衛
   - 攻撃
   - Trade/Transfer
 - 常に空きがあること
 - 必要な資源があること
   - 研究
   - Boost
   - Nuke
 */

type DeclarationType = number

interface Declaration<T extends DeclarationType> {
  decla
  getValue(): T
}

export class TerminalDeclaration {

}
