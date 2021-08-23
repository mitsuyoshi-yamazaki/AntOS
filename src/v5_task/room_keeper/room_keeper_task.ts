import { RoomInvadedProblemFinder } from "v5_problem/invasion/room_invaded_problem_finder"
import { ProblemFinder } from "v5_problem/problem_finder"
import { OwnedRoomDecayedStructureProblemFinder } from "v5_problem/structure/owned_room_decayed_structure_problem_finder"
import { RoomName } from "utility/room_name"
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
import { calculateRoomPlan } from "script/room_plan"
import { Season1838855DistributorProcess } from "process/onetime/season_1838855_distributor_process"
import { OperatingSystem } from "os/os"

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
        const distributorProcess = ((): Season1838855DistributorProcess | null => {
          return OperatingSystem.os.listAllProcesses()
            .map(processInfo => processInfo.process)
            .find(process => {
              if (!(process instanceof Season1838855DistributorProcess)) {
                return false
              }
              if (process.parentRoomName !== this.roomName) {
                return false
              }
              return true
            }) as Season1838855DistributorProcess | null
        })()

        if (distributorProcess != null) {
          ownedRoomResource.roomInfo.roomPlan = {
            centerPosition: {
              x: distributorProcess.position.x,
              y: distributorProcess.position.y,
            }
          }
        } else {
          const result = calculateRoomPlan(objects.controller, false)
          switch (result.resultType) {
          case "succeeded":
            PrimitiveLogger.notice(`${coloredText("[Warning]", "warn")} ${roomLink(this.roomName)} placed room layout`)
            ownedRoomResource.roomInfo.roomPlan = {
              centerPosition: {
                x: result.value.center.x,
                y: result.value.center.y,
              }
            }
            break
          case "failed":
            PrimitiveLogger.fatal(`${roomLink(this.roomName)} ${result.reason}`)
            break
          }

        }
      }
    }

    return TaskStatus.InProgress
  }
}
