import { ObjectTaskProfit } from "object_task/object_task_performance"
import type { V6Creep } from "prototype/creep"

/**
 * - ひとまず消費対象は問わない
 */
export interface ConsumeCreepTaskPerformance {
  timeSpent: number
  resourceConsumed: Map<ResourceConstant, number>
  bodyPartUsage: Map<BodyPartConstant, number>
}

/**
 * - [ ] Harvesterがdropして蒸発したエネルギー量は計算に入れられない
 */
export interface IncomeCreepTaskPerformance {
  timeSpent: number
  resourceProfit: Map<ResourceConstant, number>
  bodyPartUsage: Map<BodyPartConstant, number>
}

export type AnyCreepTaskPerformance = ConsumeCreepTaskPerformance | IncomeCreepTaskPerformance

export interface CreepTaskProfit<Performance> extends ObjectTaskProfit<Creep, Performance> {
  estimate(creep: V6Creep): Performance
  performance(): Performance
}

export type AnyCreepTaskProfit = EconomyCreepTaskProfit | IncomeCreepTaskProfit

export interface EconomyCreepTaskProfit extends CreepTaskProfit<ConsumeCreepTaskPerformance> {
}

export interface IncomeCreepTaskProfit extends CreepTaskProfit<IncomeCreepTaskPerformance> {
}
