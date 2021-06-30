import { InterShardCreepDelivererObjective } from "objective/creep_provider/inter_shard_creep_deliverer_objective"
import { CreepProviderPriority } from "objective/creep_provider/single_creep_provider_objective"
import { decodeObjectiveFrom, Objective, ObjectiveState } from "objective/objective"
import { Procedural } from "objective/procedural"
import { Process, processLog, ProcessState } from "objective/process"
import { spawnPriorityLow } from "objective/spawn/spawn_creep_objective"
import { generateCodename, generateUniqueId } from "utility/unique_id"

const destinationShardName = "shard3"
const spawnRoomName = "W51S29"
const portalRoomName = "W50S30"

type War29337295LogisticsProcessCreepType = "heavy_attacker"

export interface War29337295LogisticsProcessState extends ProcessState {
  /** child objective states */
  s: ObjectiveState[]
}

// Game.io("launch War29337295LogisticsProcess -l")
export class War29337295LogisticsProcess implements Process, Procedural {
  private readonly codename = generateCodename(this.constructor.name, this.launchTime)

  public constructor(
    public readonly launchTime: number,
    public readonly processId: number,
    private readonly objectives: Objective[],
  ) { }

  public encode(): War29337295LogisticsProcessState {
    return {
      t: "War29337295LogisticsProcess",
      l: this.launchTime,
      i: this.processId,
      s: this.objectives.map(objective => objective.encode())
    }
  }

  public static decode(state: War29337295LogisticsProcessState): War29337295LogisticsProcess {
    const objectives = state.s.reduce((result: Objective[], current: ObjectiveState): Objective[] => {
      const objective = decodeObjectiveFrom(current)
      if (objective != null) {
        result.push(objective)
      }
      return result
    }, [] as Objective[])
    return new War29337295LogisticsProcess(state.l, state.i, objectives)
  }

  public runOnTick(): void {
    const time = Game.time
    if (time % 249 === 0) {
      this.addCreep("heavy_attacker")
    }
  }

  private addCreep(creepType: War29337295LogisticsProcessCreepType): void {
    const creepName = generateUniqueId(this.codename)
    const body = this.bodyPatsFor(creepType)
    const priority = this.priorityFor(creepType)
    const objective = new InterShardCreepDelivererObjective(
      Game.time,
      [],
      creepName,
      portalRoomName,
      destinationShardName,
      {
        spawnRoomName,
        requestingCreepBodyParts: body,
        priority,
      }
    )
    this.objectives.push(objective)
    processLog(this, `Added ${creepType} ${creepName}`)
  }

  private priorityFor(creepType: War29337295LogisticsProcessCreepType): CreepProviderPriority {
    switch (creepType) {
    case "heavy_attacker":
      return spawnPriorityLow
    }
  }

  private bodyPatsFor(creepType: War29337295LogisticsProcessCreepType): BodyPartConstant[] {
    switch (creepType) {
    case "heavy_attacker":
      return [
        TOUGH, TOUGH, TOUGH, TOUGH,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        MOVE, MOVE, MOVE, MOVE,
        ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
        ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
        ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
        ATTACK,
        MOVE,
        HEAL, HEAL, HEAL, HEAL, HEAL,
      ]
    }
  }
}
