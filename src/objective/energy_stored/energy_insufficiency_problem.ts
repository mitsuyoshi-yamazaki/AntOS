// import { CreepInsufficiencyProblemSolver } from "objective/creep_existence/creep_insufficiency_problem_solver"
// import { Problem, ProblemIdentifier } from "objective/problem"
// import { ProblemSolver } from "objective/problem_solver"
// import { CreepRole } from "prototype/creep_role"
// import { RoomName } from "prototype/room"

// export class EnergyInsufficiencyProblem implements Problem {
//   public readonly identifier: ProblemIdentifier

//   public constructor(
//     public readonly roomName: RoomName,
//   ) {
//     this.identifier = `${this.constructor.name}_${roomName}`
//   }

//   public getProblemSolvers(): ProblemSolver[] {
//     return [
//       CreepInsufficiencyProblemSolver.create(this.identifier, this.roomName, [CreepRole.EnergyStore, CreepRole.Mover], null)  // TODO: この解法で良いのか
//     ]
//   }
// }
