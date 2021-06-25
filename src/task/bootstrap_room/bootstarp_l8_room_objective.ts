import { decodeObjectivesFrom, Objective, ObjectiveFailed, ObjectiveInProgress, ObjectiveProgressType, ObjectiveState, ObjectiveSucceeded } from "task/objective"
import { roomLink } from "utility/log"
import { BuildFirstSpawnObjective } from "./build_first_spawn_objective"
import { ClaimRoomObjective } from "./claim_room_objective"

type BootstrapL8RoomObjectiveProgressType = ObjectiveProgressType<string, StructureController, string>

export interface BootstrapL8RoomObjectiveState extends ObjectiveState {
  /** target room name */
  r: string

  /** parent room name */
  p: string
}

export class BootstrapL8RoomObjective implements Objective {
  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    public readonly targetRoomName: string,
    public readonly parentRoomName: string,
  ) {
  }

  public encode(): BootstrapL8RoomObjectiveState {
    return {
      t: "BootstrapL8RoomObjective",
      s: this.startTime,
      c: this.children.map(child => child.encode()),
      r: this.targetRoomName,
      p: this.parentRoomName,
    }
  }

  public static decode(state: BootstrapL8RoomObjectiveState): BootstrapL8RoomObjective {
    const children = decodeObjectivesFrom(state.c)
    return new BootstrapL8RoomObjective(state.s, children, state.r, state.p)
  }

  public progress(): BootstrapL8RoomObjectiveProgressType {
    const room = Game.rooms[this.targetRoomName]
    if (room == null) {
      return new ObjectiveFailed(`${this.constructor.name} only works while target room is visible (target room: ${roomLink(this.targetRoomName)})`)
    }
    if (room.controller == null) {
      return new ObjectiveFailed(`Target room ${roomLink(this.targetRoomName)} has no controller`)
    }
    if (room.controller.my !== true) {
      return this.claimTargetRoom()
    }
    if (room.controller.level >= 8) {
      return new ObjectiveSucceeded(room.controller)
    }
    if (room.spawns.length <= 0) {
      return this.buildFirstSpawn(room.controller)
    }

    return new ObjectiveInProgress("not implemented yet") // TODO:
  }

  // ---- Build first spawn ---- //
  private buildFirstSpawn(controller: StructureController): BootstrapL8RoomObjectiveProgressType {
    const objective = this.children.find(child => child instanceof BuildFirstSpawnObjective) as BuildFirstSpawnObjective | null
    if (objective == null) {
      this.addBuildFirstSpawnObjective()
      return new ObjectiveInProgress("Launched BuildFirstSpawnObjective")
    }
    const progress = objective.progress(controller, this.parentRoomName)
    switch (progress.objectProgressType) {
    case "in progress":
      return new ObjectiveInProgress(progress.value)
    case "succeeded":
      this.removeBuildFirstSpawnObjective(objective)
      return new ObjectiveInProgress(`Spawn ${progress.result.id} built at ${progress.result.pos}`)
    case "failed":
      this.removeBuildFirstSpawnObjective(objective)
      return new ObjectiveFailed(progress.reason)
    }
  }

  private addBuildFirstSpawnObjective(): void {
    const objective = new BuildFirstSpawnObjective(Game.time, [], [])
    this.children.push(objective)
  }

  private removeBuildFirstSpawnObjective(objective: BuildFirstSpawnObjective): void {
    const index = this.children.indexOf(objective)
    if (index >= 0) {
      this.children.splice(index, 1)
    }
  }

  // ---- Claim target room ---- //
  private claimTargetRoom(): BootstrapL8RoomObjectiveProgressType {
    const objective = this.children.find(child => child instanceof ClaimRoomObjective) as ClaimRoomObjective | null
    if (objective == null) {
      this.addClaimRoomObjective()
      return new ObjectiveInProgress("Launched ClaimRoomObjective")
    }
    const progress = objective.progress()
    switch (progress.objectProgressType) {
    case "in progress":
      return new ObjectiveInProgress(progress.value)
    case "succeeded":
      this.removeClaimRoomObjective(objective)
      return new ObjectiveInProgress(`Room ${roomLink(progress.result.room.name)} successfully claimed.`)
    case "failed":
      this.removeClaimRoomObjective(objective)
      return new ObjectiveFailed(progress.reason)
    }
  }

  private addClaimRoomObjective(): void {
    const objective = new ClaimRoomObjective(Game.time, [], this.targetRoomName, this.parentRoomName, null)
    this.children.push(objective)
  }

  private removeClaimRoomObjective(objective: ClaimRoomObjective): void {
    const index = this.children.indexOf(objective)
    if (index >= 0) {
      this.children.splice(index, 1)
    }
  }
}
