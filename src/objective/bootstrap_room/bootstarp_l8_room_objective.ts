import { ErrorMapper } from "error_mapper/ErrorMapper"
import { decodeObjectivesFrom, Objective, ObjectiveFailed, ObjectiveInProgress, ObjectiveProgressType, ObjectiveState, ObjectiveSucceeded } from "objective/objective"
import { roomLink } from "utility/log"
import { BuildFirstSpawnObjective } from "./build_first_spawn_objective"
import { ClaimRoomObjective } from "./claim_room_objective"
import { UpgradeL3ControllerObjective, UpgradeL3ControllerObjectiveWorkingInfo } from "./upgrade_l3_controller_objective"

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
    let progress: BootstrapL8RoomObjectiveProgressType | null = null
    ErrorMapper.wrapLoop((): void => {
      const room = Game.rooms[this.targetRoomName]
      if (room == null) {
        progress = new ObjectiveFailed(`${this.constructor.name} only works while target room is visible (target room: ${roomLink(this.targetRoomName)})`)
        return
      }
      if (room.controller == null) {
        progress = new ObjectiveFailed(`Target room ${roomLink(this.targetRoomName)} has no controller`)
        return
      }
      if (room.controller.my !== true) {
        progress = this.claimTargetRoom()
        return
      }
      if (room.controller.level >= 8) {
        progress = new ObjectiveSucceeded(room.controller)
        return
      }
      const spawn = room.find(FIND_MY_SPAWNS)[0]
      if (spawn == null) {
        progress = this.buildFirstSpawn(room.controller)
        return
      }
      // if (room.controller.level < 3) { // TODO:
      progress = this.upgradeToRCL3(spawn, room, room.controller)
      return
      // }

      // progress = new ObjectiveInProgress("not implemented yet") // TODO:
    }, "BootstrapL8RoomObjective.progress()")()

    if (progress != null) {
      return progress
    }
    return new ObjectiveFailed("Program bug")
  }

  // ---- Upgrade to RCL3 ---- //
  private upgradeToRCL3(spawn: StructureSpawn, room: Room, controller: StructureController): BootstrapL8RoomObjectiveProgressType {
    const objective = this.children.find(child => child instanceof UpgradeL3ControllerObjective) as UpgradeL3ControllerObjective | null
    if (objective == null) {
      this.addUpgradeL3ControllerObjective(room)
      return new ObjectiveInProgress("Launched UpgradeL3ControllerObjective")
    }
    const progress = objective.progress(spawn, controller)
    switch (progress.objectProgressType) {
    case "in progress":
      return new ObjectiveInProgress(progress.value)
    case "succeeded":
      this.removeUpgradeL3ControllerObjective(objective)
      return new ObjectiveInProgress(`Room ${roomLink(room.name)} upgraded to RCL 3`)
    case "failed":
      this.removeUpgradeL3ControllerObjective(objective)
      return new ObjectiveFailed(progress.reason.reason)
    }
  }

  private addUpgradeL3ControllerObjective(room: Room): void {
    const sourceIds = room.sources.map(source => source.id)
    const emptyWorkingInfo: UpgradeL3ControllerObjectiveWorkingInfo = {
      constructionSiteId: null
    }
    const workerNames = room.find(FIND_MY_CREEPS).map(creep => creep.name)
    const objective = new UpgradeL3ControllerObjective(Game.time, [], workerNames, [], [], [], sourceIds, emptyWorkingInfo)
    this.children.push(objective)
  }

  private removeUpgradeL3ControllerObjective(objective: UpgradeL3ControllerObjective): void {
    const index = this.children.indexOf(objective)
    if (index >= 0) {
      this.children.splice(index, 1)
    }
  }

  // ---- Build first spawn ---- //
  private buildFirstSpawn(controller: StructureController): BootstrapL8RoomObjectiveProgressType {
    const objective = this.children.find(child => child instanceof BuildFirstSpawnObjective) as BuildFirstSpawnObjective | null
    if (objective == null) {
      this.addBuildFirstSpawnObjective()
      return new ObjectiveInProgress("Launched BuildFirstSpawnObjective")
    }
    const progress = objective.progress(controller.room, this.parentRoomName)
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
