import { ClaimControllerTask } from "game_object_task/creep_task/claim_controller_task"
import { Procedural } from "objective/procedural"
import { Process, ProcessState } from "objective/process"
import { CreepType } from "_old/creep"

export interface Shard3BootstrapProcessState extends ProcessState {

}

// Game.io("exec PlaceOldRoomPlan room_name=W51S29 layout_name=mark06 x=15 y=15")
// Game.rooms["W51S29"].find(FIND_FLAGS).forEach(flag => flag.remove())
export class Shard3BootstrapProcess implements Process, Procedural {
  public constructor(
    public readonly launchTime: number,
    public readonly processId: number,
  ) { }

  public encode(): Shard3BootstrapProcessState {
    return {
      t: "Shard3BootstrapProcess",
      l: this.launchTime,
      i: this.processId,
    }
  }

  public static decode(state: Shard3BootstrapProcessState): Shard3BootstrapProcess {
    return new Shard3BootstrapProcess(state.l, state.i)
  }

  public processDescription(): string {
    return `Test process at ${Game.time}`
  }

  public runOnTick(): void {
    for (const creepName in Game.creeps) {
      const creep = Game.creeps[creepName]
      this.work(creep)
    }
  }

  private work(creep: Creep): void {
    if (creep.room.name !== "W51S29") {
      creep.moveToRoom("W51S29")
      return
    }

    switch (creep.memory.type) {
    case CreepType.CLAIMER:
      this.claim(creep)
      return
    case CreepType.SCOUT:
      this.scout(creep)
      return
    case CreepType.TAKE_OVER:
      this.gather(creep)
      return
    default:
      this.typeCheck(creep)
      return
    }
  }

  private typeCheck(creep: Creep): void {
    const body: BodyPartConstant[] = creep.body.map(b => b.type)
    if (body.includes(CLAIM) === true) {
      creep.memory.type = CreepType.CLAIMER
      return
    }
    if (body.includes(WORK) === true) {
      creep.memory.type = CreepType.TAKE_OVER
      return
    }
    creep.memory.type = CreepType.SCOUT
  }

  private claim(creep: Creep): void {
    if (creep.room.controller == null || creep.room.controller.my === true) {
      return
    }
    if (creep.task == null) {
      creep.task = new ClaimControllerTask(Game.time, creep.room.controller)
    }
    creep.task.run(creep)
  }

  private scout(creep: Creep): void {

  }

  private gather(creep: Creep): void {
    creep.moveTo(25, 25)
  }
}
