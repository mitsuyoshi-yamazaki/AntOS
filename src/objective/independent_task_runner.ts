
interface TaskRunner {

}

type ProblemSolver = TaskRunner

interface Situation {
  child: Situation[] | Problem
}

type Objective = Situation

interface Problem {
  availableSolvers(): TaskRunner[]
}

type TaskRunnerId = string
type TaskRunnerStatus = "in progress" | "finished" | "failed"

const TaskRunners = {
  register: function (taskRunner: TaskRunner): void {

  },
  statusOf: function (taskRunnerId: TaskRunnerId): TaskRunnerStatus {

  }
}

class RoomObserveSituation implements Situation {
  public readonly child: Situation[]

  public constructor() {
    const child: Situation[] = [
      new ScoutRoomSituation()
    ]
    this.child = child
  }
}

class ScoutRoomSituation implements Situation {
  public readonly child: Problem

  public constructor() {
    this.child = new CreepInsufficiencyProblem()
  }
}

class CreepInsufficiencyProblem implements Problem {
  public availableSolvers(): TaskRunner[] {
    return [
      new CreepInsufficiencySolver()
    ]
  }
}

class CreepInsufficiencySolver implements ProblemSolver {

}
