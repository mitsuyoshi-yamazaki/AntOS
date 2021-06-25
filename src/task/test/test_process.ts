import { Procedural } from "task/procedural"
import { Process, processLog, ProcessState } from "task/process"
import { CreepStatus } from "_old/creep"

export interface TestProcessState extends ProcessState {
}

export class TestProcess implements Process, Procedural {
  public constructor(
    public readonly launchTime: number,
    public readonly processId: number,
  ) {}

  public encode(): ProcessState {
    return {
      t: "TestProcess",
      l: this.launchTime,
      i: this.processId,
    }
  }

  public static decode(state: TestProcessState): TestProcess {
    return new TestProcess(state.l, state.i)
  }

  public processDescription(): string {
    return `Test process at ${Game.time}`
  }

  public runOnTick(): void {
    if (Game.time % 13 === 7) {
      processLog(this, `Test log at ${Game.time}`)
    }

    const creepIds: string[] = [
      "60d5b22841f0ff1d3f840e59",
      "60d5b28c31ea8dee928b3484",
      "60d5b31a9a39d1a03b195309",
      "60d5b2ae6b88b75d31605213",
      "60d5b1feaaf24f16eaef5529",
      "60d5b199adf2af453a94d948",
    ]
    const s = Game.getObjectById("59f19fc582100e1594f358bd")
    if (!(s instanceof Source)) {
      return
    }
    const source = s

    creepIds.forEach(creepId => {
      const creep = Game.getObjectById(creepId)
      if (!(creep instanceof Creep)) {
        return
      }
      switch (creep.memory.status) {
      case CreepStatus.HARVEST:
        if (creep.carry[RESOURCE_ENERGY] >= creep.carryCapacity) {
          creep.memory.status = CreepStatus.BUILD
          break
        }
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
          creep.moveTo(source)
        }
        break
      case CreepStatus.BUILD:
        if (creep.carry[RESOURCE_ENERGY] <= 0) {
          creep.memory.status = CreepStatus.HARVEST
          break
        }
        if (creep.room.controller == null) {
          break
        }
        if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
          creep.moveTo(creep.room.controller)
        }
        break
      default:
        creep.memory.status = CreepStatus.HARVEST
        break
      }
    })
  }
}
