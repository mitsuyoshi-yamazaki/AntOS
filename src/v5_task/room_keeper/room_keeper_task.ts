import { RoomInvadedProblemFinder } from "v5_problem/invasion/room_invaded_problem_finder"
import { ProblemFinder } from "v5_problem/problem_finder"
import { OwnedRoomDecayedStructureProblemFinder } from "v5_problem/structure/owned_room_decayed_structure_problem_finder"
import type { RoomName } from "shared/utility/room_name_types"
import { CreateConstructionSiteTask } from "v5_task/room_planing/create_construction_site_task"
import { OwnedRoomScoutTask } from "v5_task/scout/owned_room_scout_task"
import { Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { WorkerTask } from "v5_task/worker/worker_task"
import { OwnedRoomObjects } from "world_info/room_info"
import { RemoteRoomManagerTask } from "v5_task/remote_room_keeper/remote_room_manager_task"
import { TaskState } from "v5_task/task_state"
import { OwnedRoomDamagedCreepProblemFinder } from "v5_problem/damaged_creep/owned_room_damaged_creep_problem_finder"
import { RoomResources } from "room_resource/room_resources"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { coloredText, roomLink } from "utility/log"
import { DistributorProcess } from "process/process/distributor_process"
import { RoomPlanner } from "room_plan/room_planner"
import { Environment } from "utility/environment"
import { World35587255ScoutRoomProcess } from "process/temporary/world_35587255_scout_room_process"
import { GameConstants } from "utility/constants"
import { leftoverStructurePriority } from "v5_task/bootstrap_room/upgrade_to_rcl3_task"
import { SystemCalls } from "os/system_calls"

export interface RoomKeeperTaskState extends TaskState {
  /** room name */
  r: RoomName
}

export class RoomKeeperTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): RoomKeeperTaskState {
    return {
      t: "RoomKeeperTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
    }
  }

  public static decode(state: RoomKeeperTaskState, children: Task[]): RoomKeeperTask {
    return new RoomKeeperTask(state.s, children, state.r)
  }

  public static create(roomName: RoomName): RoomKeeperTask {
    const children: Task[] = [
      CreateConstructionSiteTask.create(roomName),
      WorkerTask.create(roomName),
      OwnedRoomScoutTask.create(roomName),
      RemoteRoomManagerTask.create(roomName),
    ]
    return new RoomKeeperTask(Game.time, children, roomName)
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    const problemFinders: ProblemFinder[] = [
      new RoomInvadedProblemFinder(objects),
      new OwnedRoomDecayedStructureProblemFinder(objects),
      new OwnedRoomDamagedCreepProblemFinder(objects),
    ]
    this.checkProblemFinders(problemFinders)

    // if (this.children.find(task => task instanceof RemoteRoomManagerTask) == null) {  // TODO: 一時コード
    //   this.addChildTask(RemoteRoomManagerTask.create(this.roomName))
    // }

    const ownedRoomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (ownedRoomResource != null) {
      if (ownedRoomResource.roomInfo.roomPlan == null) {  // FixMe: roomInfo.roomPlanのMigration処理：流したら消す
        const roomPlanner = new RoomPlanner(objects.controller, {dryRun: false})
        const result = roomPlanner.run()
        switch (result.resultType) {
        case "succeeded":
          PrimitiveLogger.notice(`${coloredText("[Warning]", "warn")} ${roomLink(this.roomName)} placed room layout`)
          ownedRoomResource.roomInfo.roomPlan = {
            centerPosition: {
              x: result.value.center.x,
              y: result.value.center.y,
            }
          }
          SystemCalls.systemCall()?.addProcess(null, processId => DistributorProcess.create(processId, this.roomName))

          switch (Environment.world) {
          case "persistent world":
          case "simulation":
            break
          case "season 4":
          case "botarena":
          case "swc":
            SystemCalls.systemCall()?.addProcess(null, processId => World35587255ScoutRoomProcess.create(processId, this.roomName))
            break
          }
          this.turnAttackNotificationOn(objects.controller.room)
          this.removeLeftoverFlags(objects.controller.room)
          this.removeLeftoverStructures(objects.controller.room)
          this.removeConstructionSites(objects.controller.room)
          break
        case "failed":
          PrimitiveLogger.fatal(`${this.taskIdentifier} ${roomLink(this.roomName)} ${result.reason}`)
          break
        }
      }
    }

    return TaskStatus.InProgress
  }

  private removeConstructionSites(room: Room): void {
    room.find(FIND_CONSTRUCTION_SITES)
      .filter(constructionSite => constructionSite.my !== true)
      .forEach(constructionSite => constructionSite.remove())
  }

  private turnAttackNotificationOn(room: Room): void {
    room.find(FIND_MY_STRUCTURES).forEach(structure => {
      structure.notifyWhenAttacked(true)
    })
  }

  private removeLeftoverFlags(room: Room): void {
    const min = GameConstants.room.edgePosition.min
    const max = GameConstants.room.edgePosition.max
    room.find(FIND_FLAGS).forEach(flag => {
      if (flag.pos.x !== min && flag.pos.x !== max && flag.pos.y !== min && flag.pos.y !== max) {
        return
      }
      flag.remove()
    })
  }

  private removeLeftoverStructures(room: Room): void {
    const excludedHostileStructures = [
      ...leftoverStructurePriority
    ]
    const wallTypes: StructureConstant[] = [
      STRUCTURE_WALL,
      // STRUCTURE_RAMPART, // 現在は対処できないので削除
    ]

    room.find(FIND_STRUCTURES).forEach(structure => {
      if ((structure as { my?: boolean }).my === true) {
        if (structure.structureType !== STRUCTURE_CONTROLLER) {
          PrimitiveLogger.programError(`${this.taskIdentifier} iterating owned structure: ${structure}`)
        }
        return
      }

      if (wallTypes.includes(structure.structureType) === true) {
        structure.destroy()
        return
      }

      if (excludedHostileStructures.includes(structure.structureType) === true) {
        try {
          const store = (structure as { store?: StoreDefinition }).store
          if (store == null) {
            return
          }
          if (store.getUsedCapacity() > 0) {
            return
          }
        } catch (e) {
          PrimitiveLogger.programError(`${this.taskIdentifier} removeLeftoverStructures() failed: ${e}`)
        }
        structure.destroy()
        return
      }

      structure.destroy()
    })
  }
}
