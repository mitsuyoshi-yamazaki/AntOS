import { RoomKeeperProcess } from "process/room_keeper_process"
import { RoomName } from "utility/room_name"
import { RoomKeeperTask } from "v5_task/room_keeper/room_keeper_task"
import { Migration } from "utility/migration"
import { ShortVersion } from "utility/system_info"
import { World } from "world_info/world_info"
import { BootstrapRoomManagerProcess } from "process/bootstrap_room_manager_process"
import type { Process } from "process/process"
import type { ProcessLauncher } from "os/os_process_launcher"

export class ApplicationProcessLauncher {
  public launchProcess(processList: Process[], processLauncher: ProcessLauncher): void {
    this.checkV5RoomKeeperProcess(processList, processLauncher)
    this.checkBoostrapRoomManagerProcess(processList, processLauncher)
  }

  private checkV5RoomKeeperProcess(processList: Process[], processLauncher: ProcessLauncher): void {
    const roomsWithV5KeeperProcess = processList.map(process => {
      if (process instanceof RoomKeeperProcess) {
        return process.roomName
      }
      return null
    })

    World.rooms.getAllOwnedRooms().forEach(room => {
      switch (Migration.roomVersion(room.name)) {
      case ShortVersion.v3:
        return
      case ShortVersion.v5:
        if (roomsWithV5KeeperProcess.includes(room.name) === true) {
          return
        }
        this.launchV5RoomKeeperProcess(room.name, processLauncher)
        return
      }
    })
  }

  private launchV5RoomKeeperProcess(roomName: RoomName, processLauncher: ProcessLauncher): void {
    const roomKeeperTask = RoomKeeperTask.create(roomName)
    processLauncher(processId => RoomKeeperProcess.create(processId, roomKeeperTask))
  }

  private checkBoostrapRoomManagerProcess(processList: Process[], processLauncher: ProcessLauncher): void {
    if (processList.some(process => process instanceof BootstrapRoomManagerProcess) === true) {
      return
    }
    processLauncher(processId => BootstrapRoomManagerProcess.create(processId))
  }
}
