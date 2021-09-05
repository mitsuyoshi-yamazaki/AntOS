import { RoomKeeperProcess } from "process/room_keeper_process"
import { RoomName } from "utility/room_name"
import { RoomKeeperTask as V5RoomKeeperTask } from "v5_task/room_keeper/room_keeper_task"
import { Migration } from "utility/migration"
import { ShortVersion } from "utility/system_info"
import { World } from "world_info/world_info"
import { BootstrapRoomManagerProcess } from "process/bootstrap_room_manager_process"
import type { Process } from "process/process"
import type { ProcessLauncher } from "os/os_process_launcher"
import { V6RoomKeeperProcess } from "process/v6_room_keeper_process"
import { RoomKeeperTask } from "application/task/room_keeper/room_keeper_task"
import { PrimitiveLogger } from "../primitive_logger"
import { coloredText, roomLink } from "utility/log"
import { Season487837AttackInvaderCoreProcess } from "process/onetime/season_487837_attack_invader_core_process"

export class ApplicationProcessLauncher {
  public launchProcess(processList: Process[], processLauncher: ProcessLauncher): void {
    this.checkRoomKeeperProcess(processList, processLauncher)
    this.checkBoostrapRoomManagerProcess(processList, processLauncher)
    this.checkAttackInvaderCoreProcess(processList, processLauncher)
  }

  private checkRoomKeeperProcess(processList: Process[], processLauncher: ProcessLauncher): void {
    const roomsWithV5KeeperProcess = processList.map(process => {
      if (process instanceof RoomKeeperProcess) {
        return process.roomName
      }
      return null
    })
    const roomsWithV6KeeperProcess = processList.map(process => {
      if (process instanceof V6RoomKeeperProcess) {
        return process.roomName
      }
      return null
    })

    World.rooms.getAllOwnedRooms().forEach(room => {
      switch (Migration.roomVersion(room.name)) {
      case ShortVersion.v5:
        if (roomsWithV5KeeperProcess.includes(room.name) !== true) {
          this.launchV5RoomKeeperProcess(room.name, processLauncher)
        }
        if (roomsWithV6KeeperProcess.includes(room.name) !== true) {
          this.launchV6RoomKeeperProcess(room.name, processLauncher)  // v6に移行途中
        }
        return
      case ShortVersion.v6:
        if (roomsWithV6KeeperProcess.includes(room.name) === true) {
          return
        }
        this.launchV6RoomKeeperProcess(room.name, processLauncher)
        return
      }
    })
  }

  private launchV5RoomKeeperProcess(roomName: RoomName, processLauncher: ProcessLauncher): void {
    const roomKeeperTask = V5RoomKeeperTask.create(roomName)
    processLauncher(null, processId => RoomKeeperProcess.create(processId, roomKeeperTask))
  }

  private launchV6RoomKeeperProcess(roomName: RoomName, processLauncher: ProcessLauncher): void {
    PrimitiveLogger.log(`${coloredText("[Launched]", "info")} V6RoomKeeperProcess ${roomLink(roomName)}`)
    const roomKeeperTask = RoomKeeperTask.create(roomName)
    processLauncher(null, processId => V6RoomKeeperProcess.create(processId, roomKeeperTask))
  }

  private checkBoostrapRoomManagerProcess(processList: Process[], processLauncher: ProcessLauncher): void {
    if (processList.some(process => process instanceof BootstrapRoomManagerProcess) === true) {
      return
    }
    processLauncher(null, processId => BootstrapRoomManagerProcess.create(processId))
  }

  private checkAttackInvaderCoreProcess(processList: Process[], processLauncher: ProcessLauncher): void {
    if (processList.some(process => process instanceof Season487837AttackInvaderCoreProcess) === true) {
      return
    }
    processLauncher(null, processId => Season487837AttackInvaderCoreProcess.create(processId))
  }
}
