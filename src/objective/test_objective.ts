import { State, Stateful } from "os/infrastructure/state";

export interface ObjectiveState extends State {

}

export interface Objective extends Stateful {

}

// ----
export interface RCL2ObjectiveState {

}

/**
 * - 引き継ぎ条件
 * - 達成しなければならないタスク
 * - energy efficiencyなwork
 */
export class RCL2Objective {
  private constructor(
    public readonly childObjectives: Objective[],
  ) { }

  public static createObjective(): RCL2Objective {
    return new RCL2Objective([])
  }

  public currentState(controller: StructureController):
}
