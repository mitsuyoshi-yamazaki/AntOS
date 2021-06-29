import { MoveToPortalTask } from "game_object_task/creep_task/move_to_position_task"
import { decodeObjectivesFrom, Objective, ObjectiveFailed, ObjectiveInProgress, ObjectiveProgressType, ObjectiveState, ObjectiveSucceeded } from "objective/objective"
import { CreepName } from "prototype/creep"
import { RoomName } from "prototype/room"
import { ShardName } from "prototype/shard"
import { roomLink } from "utility/log"
import { SingleCreepProviderObjective, SingleCreepProviderSpawnPriority } from "./single_creep_provider_objective"

type InterShardCreepDelivererObjectiveProgressType = ObjectiveProgressType<void, Creep, string>

export interface InterShardCreepDelivererObjectiveState extends ObjectiveState {
  /** requesting creep name */
  n: CreepName

  /** portal room name */
  p: RoomName

  /** destination shard name */
  d: ShardName
}

/**
 * - portalまで送り出したら成功して終了
 *   - それ以降はrequest元shardでSingleCreepInterShardProviderObjectiveが引き継ぎ
 */
export class InterShardCreepDelivererObjective implements Objective {
  private readonly creepProvider: SingleCreepProviderObjective | null

  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    private readonly creepName: CreepName,
    private readonly portalRoomName: RoomName,
    public readonly destinationShardName: ShardName,
    launchTimeArguments: {
      spawnRoomName: string,
      requestingCreepBodyParts: BodyPartConstant[],
      priority: SingleCreepProviderSpawnPriority,
    } | null
  ) {
    if (launchTimeArguments != null) {
      const newProvider = new SingleCreepProviderObjective(Game.time, [], this.creepName, launchTimeArguments)
      this.children.push(newProvider)
      this.creepProvider = newProvider
    } else {
      let creepProvider: SingleCreepProviderObjective | null = null
      for (const child of this.children) {
        if (child instanceof SingleCreepProviderObjective) {
          creepProvider = child
        }
      }
      this.creepProvider = creepProvider
    }
  }

  public encode(): InterShardCreepDelivererObjectiveState {
    return {
      s: this.startTime,
      t: "InterShardCreepDelivererObjective",
      c: this.children.map(child => child.encode()),
      n: this.creepName,
      p: this.portalRoomName,
      d: this.destinationShardName,
    }
  }

  public static decode(state: InterShardCreepDelivererObjectiveState): InterShardCreepDelivererObjective {
    const children = decodeObjectivesFrom(state.c)
    return new InterShardCreepDelivererObjective(state.s, children, state.n, state.p, state.d, null)
  }

  public progress(): InterShardCreepDelivererObjectiveProgressType {
    if (this.creepProvider != null) {
      const progress = this.creepProvider.progress()
      switch (progress.objectProgressType) {
      case "in progress":
        return new ObjectiveInProgress(undefined)
      case "succeeded":
        this.removeCreepProvider(this.creepProvider)
        return new ObjectiveInProgress(undefined)
      case "failed":
        this.removeCreepProvider(this.creepProvider)
        return new ObjectiveFailed(progress.reason)
      }
    }

    const creep = Game.creeps[this.creepName]
    if (creep == null) {
      return new ObjectiveFailed(`Unexpected error: no creep ${this.creepName}`)
    }

    return this.moveCreep(creep)
  }

  private removeCreepProvider(creepProvider: SingleCreepProviderObjective): void {
    const index = this.children.indexOf(creepProvider)
    if (index < 0) {
      return
    }
    this.children.splice(index, 1)
  }

  private moveCreep(creep: Creep): InterShardCreepDelivererObjectiveProgressType {
    if (creep.room.name !== this.portalRoomName) {
      creep.moveToRoom(this.portalRoomName)
      return new ObjectiveInProgress(undefined)
    }

    const portal = creep.room
      .find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_PORTAL } })
      .filter(structure => {
        if (structure.structureType !== STRUCTURE_PORTAL) {
          return false
        }
        const anyPortal = structure as StructurePortal
        if (anyPortal.destination instanceof RoomPosition) {
          return false
        }
        if (anyPortal.destination.shard === this.destinationShardName) {
          return true
        }
        return false
      })[0] as StructurePortal | null

    if (portal == null) {
      return new ObjectiveFailed(`No portal to ${this.destinationShardName} found in room ${roomLink(this.portalRoomName)}`)
    }

    const task = ((): MoveToPortalTask => {
      if (creep.task instanceof MoveToPortalTask) {
        return creep.task
      }
      const newTask = new MoveToPortalTask(Game.time, portal)
      creep.task = newTask
      return newTask
    })()

    const result = task.run(creep)
    switch (result) {
    case "in progress":
      return new ObjectiveInProgress(undefined)
    case "finished":
      creep.task = null
      return new ObjectiveSucceeded(creep)
    case "failed":
      creep.task = null
      return new ObjectiveFailed(`MoveToPortalTask failed in ${roomLink(creep.room.name)}`)
    }
  }
}
