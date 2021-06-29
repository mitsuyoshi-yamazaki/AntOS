import { RoomKeeperObjective } from "objective/room_keeper/room_keeper_objective"
import { RoomKeeperProcess } from "objective/room_keeper/room_keeper_process"
import { OperatingSystem, ProcessInfo } from "os/os"
import { RoomName } from "prototype/room"
import { Migration } from "utility/migration"

export class ApplicationProcessLauncher {
  public launchProcess(): void {
    const allProcessInfo = OperatingSystem.os.listAllProcesses()
    this.roomsNeedKeeper(allProcessInfo).forEach(roomName => this.launchRoomKeeperProcess(roomName))
  }

  private roomsNeedKeeper(allProcessInfo: ProcessInfo[]): RoomName[] {
    const roomsWithKeeperProcess = allProcessInfo.map(processInfo => {
      if (processInfo.process instanceof RoomKeeperProcess) {
        return processInfo.process.roomName
      }
      return null
    })

    const roomNames: RoomName[] = []
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName]
      if (room.controller == null) {
        continue
      }
      if (room.controller.my !== true) {
        continue
      }
      if (Migration.isOldRoom(roomName) === true) {
        continue
      }
      if (roomsWithKeeperProcess.includes(roomName) === true) {
        continue
      }
      roomNames.push(roomName)
    }

    return roomNames
  }

  private launchRoomKeeperProcess(roomName: RoomName): void {
    const time = Game.time
    const objective = new RoomKeeperObjective(time, [], roomName)
    OperatingSystem.os.addProcess(processId => new RoomKeeperProcess(time, processId, objective))
  }
}
