import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Task } from "./task"
import type { TaskState } from "./task_state"
import { BuildContainerTask, BuildContainerTaskState } from "./build/build_container_task"
import { CreepInsufficiencyProblemSolver, CreepInsufficiencyProblemSolverState } from "./creep_spawn/creep_insufficiency_problem_solver"
import { TowerInterceptionProblemSolver, TowerInterceptionProblemSolverState } from "./defence/tower_interception_problem_solver"
import { OwnedRoomHarvesterTask, OwnedRoomHarvesterTaskState } from "./harvester/owned_room_harvester_task"
import { RemoteRoomHarvesterTask, RemoteRoomHarvesterTaskState } from "./remote_room_keeper/remote_room_harvester_task"
import { OwnedRoomHaulerTask, OwnedRoomHaulerTaskState } from "./hauler/owned_room_hauler_task"
import { TowerRepairProblemSolver, TowerRepairProblemSolverState } from "./repair/tower_repair_problem_solver"
import { RoomKeeperTask, RoomKeeperTaskState } from "./room_keeper/room_keeper_task"
import { CreateConstructionSiteTask, CreateConstructionSiteTaskState } from "./room_planing/create_construction_site_task"
import { OwnedRoomScoutTask, OwnedRoomScoutTaskState } from "./scout/owned_room_scout_task"
import { ScoutRoomsTask, ScoutRoomsTaskState } from "./scout/scout_rooms_task"
import { GeneralWorkerTask, GeneralWorkerTaskState } from "./worker/general_worker_task"
import { PrimitiveWorkerTask, PrimitiveWorkerTaskState } from "./worker/primitive_worker_task"
import { WorkerTask, WorkerTaskState } from "./worker/worker_task"
import { RemoteRoomKeeperTask, RemoteRoomKeeperTaskState } from "./remote_room_keeper/remote_room_keeper_task"
import { RoomInvisibleProblemSolver, RoomInvisibleProblemSolverState } from "./scout/room_invisible_problem_solver"
import { RemoteRoomManagerTask, RemoteRoomManagerTaskState } from "./remote_room_keeper/remote_room_manager_task"
import { ScoutRoomTask, ScoutRoomTaskState } from "./scout/scout_room_task"
import { RemoteRoomReserveTask, RemoteRoomReserveTaskState } from "./remote_room_keeper/remote_room_reserve_task"
import { RemoteRoomHaulerTask, RemoteRoomHaulerTaskState } from "./remote_room_keeper/remote_room_harvester_hauler_task"
import { RemoteRoomWorkerTask, RemoteRoomWorkerTaskState } from "./remote_room_keeper/remote_room_worker_task"
import { ClaimRoomTask, ClaimRoomTaskState } from "./bootstrap_room/claim_room_task"
import { BootstrapRoomTask, BootstrapRoomTaskState } from "./bootstrap_room/bootstrap_room_task"
import { UpgradeToRcl3Task, UpgradeToRcl3TaskState } from "./bootstrap_room/upgrade_to_rcl3_task"
import { RouteCheckTask, RouteCheckTaskState } from "./scout/route_check_task"
import { ActivateSafemodeProblemSolver, ActivateSafemodeProblemSolverState } from "./defence/activate_safemode_task"
import { UpgraderTask, UpgraderTaskState } from "./upgrader/upgrader_task"
import { SpecializedWorkerTask, SpecializedWorkerTaskState } from "./worker/specialized_worker_task"

export type TaskType = keyof TaskMap
class TaskMap {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "RoomKeeperTask" = (state: TaskState) => RoomKeeperTask.decode(state as unknown as RoomKeeperTaskState, decodeTasksFrom(state.c))
  "TowerInterceptionProblemSolver" = (state: TaskState) => TowerInterceptionProblemSolver.decode(state as unknown as TowerInterceptionProblemSolverState, decodeTasksFrom(state.c))
  "CreateConstructionSiteTask" = (state: TaskState) => CreateConstructionSiteTask.decode(state as unknown as CreateConstructionSiteTaskState, decodeTasksFrom(state.c))
  "PrimitiveWorkerTask" = (state: TaskState) => PrimitiveWorkerTask.decode(state as unknown as PrimitiveWorkerTaskState, decodeTasksFrom(state.c))
  "CreepInsufficiencyProblemSolver" = (state: TaskState) => CreepInsufficiencyProblemSolver.decode(state as unknown as CreepInsufficiencyProblemSolverState, decodeTasksFrom(state.c))
  "OwnedRoomHarvesterTask" = (state: TaskState) => OwnedRoomHarvesterTask.decode(state as unknown as OwnedRoomHarvesterTaskState, decodeTasksFrom(state.c))
  "GeneralWorkerTask" = (state: TaskState) => GeneralWorkerTask.decode(state as unknown as GeneralWorkerTaskState, decodeTasksFrom(state.c))
  "WorkerTask" = (state: TaskState) => WorkerTask.decode(state as unknown as WorkerTaskState, decodeTasksFrom(state.c))
  "OwnedRoomHaulerTask" = (state: TaskState) => OwnedRoomHaulerTask.decode(state as unknown as OwnedRoomHaulerTaskState, decodeTasksFrom(state.c))
  "TowerRepairProblemSolver" = (state: TaskState) => TowerRepairProblemSolver.decode(state as unknown as TowerRepairProblemSolverState, decodeTasksFrom(state.c))
  "OwnedRoomScoutTask" = (state: TaskState) => OwnedRoomScoutTask.decode(state as unknown as OwnedRoomScoutTaskState, decodeTasksFrom(state.c))
  "ScoutRoomsTask" = (state: TaskState) => ScoutRoomsTask.decode(state as unknown as ScoutRoomsTaskState, decodeTasksFrom(state.c))
  "ScoutRoomTask" = (state: TaskState) => ScoutRoomTask.decode(state as unknown as ScoutRoomTaskState, decodeTasksFrom(state.c))
  "BuildContainerTask" = (state: TaskState) => BuildContainerTask.decode(state as unknown as BuildContainerTaskState, decodeTasksFrom(state.c))
  "RemoteRoomKeeperTask" = (state: TaskState) => RemoteRoomKeeperTask.decode(state as unknown as RemoteRoomKeeperTaskState, decodeTasksFrom(state.c))
  "RoomInvisibleProblemSolver" = (state: TaskState) => RoomInvisibleProblemSolver.decode(state as unknown as RoomInvisibleProblemSolverState, decodeTasksFrom(state.c))
  "RemoteRoomManagerTask" = (state: TaskState) => RemoteRoomManagerTask.decode(state as unknown as RemoteRoomManagerTaskState, decodeTasksFrom(state.c))
  "RemoteRoomHarvesterTask" = (state: TaskState) => RemoteRoomHarvesterTask.decode(state as unknown as RemoteRoomHarvesterTaskState, decodeTasksFrom(state.c))
  "RemoteRoomReserveTask" = (state: TaskState) => RemoteRoomReserveTask.decode(state as unknown as RemoteRoomReserveTaskState, decodeTasksFrom(state.c))
  "RemoteRoomHaulerTask" = (state: TaskState) => RemoteRoomHaulerTask.decode(state as unknown as RemoteRoomHaulerTaskState, decodeTasksFrom(state.c))
  "RemoteRoomWorkerTask" = (state: TaskState) => RemoteRoomWorkerTask.decode(state as unknown as RemoteRoomWorkerTaskState, decodeTasksFrom(state.c))
  "ClaimRoomTask" = (state: TaskState) => ClaimRoomTask.decode(state as unknown as ClaimRoomTaskState, decodeTasksFrom(state.c))
  "BootstrapRoomTask" = (state: TaskState) => BootstrapRoomTask.decode(state as unknown as BootstrapRoomTaskState, decodeTasksFrom(state.c))
  "UpgradeToRcl3Task" = (state: TaskState) => UpgradeToRcl3Task.decode(state as unknown as UpgradeToRcl3TaskState, decodeTasksFrom(state.c))
  "RouteCheckTask" = (state: TaskState) => RouteCheckTask.decode(state as unknown as RouteCheckTaskState, decodeTasksFrom(state.c))
  "UpgraderTask" = (state: TaskState) => UpgraderTask.decode(state as unknown as UpgraderTaskState, decodeTasksFrom(state.c))
  "ActivateSafemodeProblemSolver" = (state: TaskState) => ActivateSafemodeProblemSolver.decode(state as unknown as ActivateSafemodeProblemSolverState, decodeTasksFrom(state.c))
  "SpecializedWorkerTask" = (state: TaskState) => SpecializedWorkerTask.decode(state as unknown as SpecializedWorkerTaskState, decodeTasksFrom(state.c))
}
const taskMap = new TaskMap()

export function decodeTaskFrom(state: TaskState): Task | null {
  const result = ErrorMapper.wrapLoop((): Task | false => {
    const decoder = taskMap[state.t]
    if (decoder == null) {
      const message = `Decode failed by program bug: missing decoder (task type identifier: ${state.t})`
      PrimitiveLogger.fatal(message)
      return false
    }
    return decoder(state) ?? false
  }, `decodeTaskFrom(), process type: ${state.t}`)()

  if (result == null) {
    const message = `Decode failed by program bug (task type identifier: ${state.t})`
    PrimitiveLogger.fatal(message)
    return null
  }
  if (result === false) {
    return null
  }
  return result
}

export function decodeTasksFrom(states: TaskState[]): Task[] {
  return states.flatMap(state => {
    const task = decodeTaskFrom(state)
    return task != null ? [task] : []
  })
}
