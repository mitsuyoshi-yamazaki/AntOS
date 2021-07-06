import { CreepInsufficiencyProblem } from "objective/creep_existence/creep_insufficiency_problem"
import { RoomSafetyObjective } from "objective/defence/room_safety_objective"
import { LaunchableObjective, Objective } from "objective/objective"
import { Problem } from "objective/problem"
import { CreateConstructionSiteTaskRunner } from "objective/room_planning/create_construction_site_task_runner"
import { TaskRunner } from "objective/task_runner"
import { OwnedRoomWorkTaskRunner } from "objective/worker/owned_room_worker_task_runner"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { RoomName } from "prototype/room"
import { generateCodename } from "utility/unique_id"
import { CreepSpawnRequest, CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"

const minimumCreepCount = 4
const creepCountForEachSource = 8

export class RoomKeeperObjective implements LaunchableObjective {
  public readonly type = "RoomKeeperObjective"
  public readonly children: Objective[]
  public readonly roomName: RoomName

  public constructor(
    public readonly objects: OwnedRoomObjects,
  ) {
    this.roomName = this.objects.controller.room.name
    this.children = [
      new RoomSafetyObjective(this.objects),
    ]
  }

  public taskRunners(): TaskRunner[] {
    const taskRunners: TaskRunner[] = [
      new CreateConstructionSiteTaskRunner(this.objects),
      new OwnedRoomWorkTaskRunner(this.objects),
    ]
    taskRunners.push(...this.children.flatMap(child => child.taskRunners()))
    return taskRunners
  }

  public currentProblems(): Problem[] {
    const numberOfCreeps = World.resourcePools.countAllCreeps(this.roomName, () => true)  // TODO: もう少し厳密な条件にする
    const insufficientCreepCount = minimumCreepCount - numberOfCreeps

    let problems = this.children.flatMap(child => child.currentProblems())
    if (insufficientCreepCount > 0) {
      problems = problems.filter(problem => !(problem instanceof CreepInsufficiencyProblem))

      const request: CreepSpawnRequest = {
        priority: CreepSpawnRequestPriority.High,
        numberOfCreeps: insufficientCreepCount,
        codename: generateCodename(this.constructor.name, this.roomName.split("").reduce((r, c) => r + c.charCodeAt(0), 0)),
        roles: [CreepRole.Worker, CreepRole.Mover, CreepRole.EnergyStore],
        body: [CARRY, WORK, MOVE],
        initialTask: null,
        taskRunnerIdentifier: null,
        parentRoomName: null,
      }

      problems.push(new CreepInsufficiencyProblem(this.roomName, request))
    } else {
      const workerRole = [CreepRole.Worker, CreepRole.Mover]
      const numberOfWorkers = World.resourcePools.countCreeps(
        this.roomName,
        null,
        creep => hasNecessaryRoles(creep, workerRole),
      )
      const insufficientWorkerCount = creepCountForEachSource * this.objects.sources.length - numberOfWorkers
      if (insufficientWorkerCount > 0) {
        const request: CreepSpawnRequest = {
          priority: CreepSpawnRequestPriority.Medium,
          numberOfCreeps: insufficientWorkerCount,
          codename: generateCodename(this.constructor.name, this.roomName.split("").reduce((r, c) => r + c.charCodeAt(0), 0)),
          roles: [CreepRole.Worker, CreepRole.Mover, CreepRole.EnergyStore],
          body: null,
          initialTask: null,
          taskRunnerIdentifier: null,
          parentRoomName: null,
        }

        problems.push(new CreepInsufficiencyProblem(this.roomName, request))
      }
    }
    return problems
  }
}
