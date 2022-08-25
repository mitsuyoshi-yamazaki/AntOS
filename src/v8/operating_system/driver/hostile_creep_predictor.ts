/**
 # HostileCreepPredictor
 ## 概要
 */

import { SystemCall } from "../system_call"

type PredictionUnknown = {
  readonly case: "unknown"
}
type PredictionPassiveAttack = {
  readonly case: "passive attack"
}
type PredictionPeaceful = {
  readonly case: "peaceful"
}

/** Invader */
type PredictionFollowClosest = {
  readonly case: "follow closest"
}

/** Source Keeper */
type PredictionGuardPosition = {
  readonly case: "guard position"
  readonly position: RoomPosition
  readonly range: number
}

type Prediction = PredictionUnknown
  | PredictionPassiveAttack
  | PredictionPeaceful
  | PredictionFollowClosest
  | PredictionGuardPosition

type HostileCreep = {
  readonly creep: Creep
  readonly prediction: Prediction
}

interface HostileCreepPredictorInterface extends SystemCall {
  getPrediction(hostileCreep: Creep): HostileCreep
}

export const HostileCreepPredictor: HostileCreepPredictorInterface = {
}
