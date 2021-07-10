import { OperatingSystem, ProcessInfo } from "os/os"
import { RoomKeeperProcess } from "process/room_keeper_process"
import { RoomName } from "utility/room_name"
import { RoomKeeperTask } from "task/room_keeper/room_keeper_task"
import { Migration } from "utility/migration"
import { ShortVersion } from "utility/system_info"
import { World } from "world_info/world_info"
import { BootstrapRoomManagerProcess } from "process/bootstrap_room_manager_process"

export class ApplicationProcessLauncher {
  public launchProcess(): void {
    const allProcessInfo = OperatingSystem.os.listAllProcesses()

    this.checkV5RoomKeeperProcess(allProcessInfo)
    this.checkBoostrapRoomManagerProcess(allProcessInfo)
  }

  private checkV5RoomKeeperProcess(allProcessInfo: ProcessInfo[]): void {
    const roomsWithV5KeeperProcess = allProcessInfo.map(processInfo => {
      if (processInfo.process instanceof RoomKeeperProcess) {
        return processInfo.process.roomName
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
        this.launchV5RoomKeeperProcess(room.name)
        return
      }
    })
  }

  private launchV5RoomKeeperProcess(roomName: RoomName): void {
    const roomKeeperTask = RoomKeeperTask.create(roomName)
    OperatingSystem.os.addProcess(processId => RoomKeeperProcess.create(processId, roomKeeperTask))
  }

  private checkBoostrapRoomManagerProcess(allProcessInfo: ProcessInfo[]): void {
    if (allProcessInfo.some(info => info.process instanceof BootstrapRoomManagerProcess) === true) {
      return
    }
    this.launchBootstrapRoomManagerProcess()
  }

  private launchBootstrapRoomManagerProcess(): void {
    OperatingSystem.os.addProcess(processId => BootstrapRoomManagerProcess.create(processId))
  }
}
