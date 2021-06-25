import { ErrorMapper } from "error_mapper/ErrorMapper"
import { decodeCreepTask } from "game_object_task/game_object_task"
import { InfrastructureProcessLauncher } from "./infrastructure_process_launcher"

export class RootProcess {
  private readonly processLauncher = new InfrastructureProcessLauncher()

  public constructor() {
  }

  public setup(): void {
    ErrorMapper.wrapLoop(() => {
      this.processLauncher.launchProcess()
    }, "RootProcess.processLauncher.launchProcess()")()
  }

  public runBeforeTick(): void {
    for (const creep_name in Game.creeps) {
      const creep = Game.creeps[creep_name]
      creep.task = decodeCreepTask(creep)
    }
  }

  public runAfterTick(): void {
    for (const creep_name in Game.creeps) {
      const creep = Game.creeps[creep_name]
      creep.memory.ts = creep.task?.encode() ?? null
    }
  }
}
