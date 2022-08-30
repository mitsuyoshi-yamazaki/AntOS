/**
 # ClaimedRoomProcessInterface
 ## 概要
 ゲームオブジェクトの状態に直接影響されるProcessのinterface
 どのような形が最適か考え中
 */

export interface ClaimedRoomProcessInterface {
  isAffectedProcess()

  prepareUnclaim(): { canKill: boolean }
}
