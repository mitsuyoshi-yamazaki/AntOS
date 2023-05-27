import { ProblemFinder, ProblemIdentifier } from "v5_problem/problem_finder"
import { ProblemSolver } from "v5_problem/problem_solver"
import type { RoomName } from "shared/utility/room_name_types"
import { TowerInterceptionProblemSolver } from "v5_task/defence/tower_interception_problem_solver"
import { OwnedRoomObjects } from "world_info/room_info"
import { ActivateSafemodeProblemSolver } from "v5_task/defence/activate_safemode_task"
import { World } from "world_info/world_info"
import { Environment } from "utility/environment"

// TODO: プレイヤーによる攻撃をroom_attacked_problem_finderに分離する
export class RoomInvadedProblemFinder implements ProblemFinder {
  public readonly roomName: RoomName
  public readonly identifier: ProblemIdentifier

  public constructor(
    public readonly objects: OwnedRoomObjects,
  ) {
    this.roomName = this.objects.controller.room.name
    this.identifier = `${this.constructor.name}_${this.roomName}`
  }

  public problemExists(): boolean {
    return this.objects.hostiles.creeps.length > 0 || this.objects.hostiles.powerCreeps.length > 0
  }

  public getProblemSolvers(): ProblemSolver[] {
    const problemSolvers: ProblemSolver[] = []

    const towerExists = this.objects.activeStructures.towers.length > 0
    if (towerExists) {
      problemSolvers.push(TowerInterceptionProblemSolver.create(this.identifier, this.roomName))
    }
    const roomObjects = World.rooms.getOwnedRoomObjects(this.roomName)
    if ((this.objects.roomInfo.bootstrapping !== true || Environment.isAutomatic() === true) && roomObjects != null && roomObjects.controller.safeMode == null) {
      const shouldActivateSafemode = ((): boolean => {
        for (const hostileCreep of roomObjects.hostiles.creeps) {
          if (hostileCreep.getActiveBodyparts(ATTACK) > 0 || hostileCreep.getActiveBodyparts(RANGED_ATTACK) > 0 || hostileCreep.getActiveBodyparts(WORK) > 0) {
            return true
          }
          const constructionSites = hostileCreep.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 4)
          if (constructionSites.length > 0) {
            return true
          }
        }
        return false
      })()
      if (shouldActivateSafemode === true) {
        problemSolvers.push(ActivateSafemodeProblemSolver.create(this.identifier, this.roomName))
      }
    }
    // TODO: 低レベルではcreepを退避させる

    return problemSolvers
  }
}
