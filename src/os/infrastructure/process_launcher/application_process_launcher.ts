import { LaunchableObjectiveType } from "objective/objective"
import { OperatingSystem } from "os/os"
import { ObjectiveProcess } from "process/objective_process"
import { isV4CreepMemory, V4CreepMemory } from "prototype/creep"
import { RoomName } from "prototype/room"
import { roomLink } from "utility/log"
import { Migration } from "utility/migration"
import { ShortVersion } from "utility/system_info"
import { World } from "world_info/world_info"
import { CreepType } from "_old/creep"
import { PrimitiveLogger } from "../primitive_logger"

export class ApplicationProcessLauncher {
  public launchProcess(): void {
    const allProcessInfo = OperatingSystem.os.listAllProcesses()
    const roomsWithV5KeeperProcess = allProcessInfo.map(processInfo => {
      if (processInfo.process instanceof ObjectiveProcess) {
        return processInfo.process.roomName
      }
      return null
    })

    World.rooms.getAllOwnedRooms().forEach(room => {
      switch (Migration.roomVersion(room.name)) {
      case ShortVersion.v3:
        return
      case ShortVersion.v4:
        PrimitiveLogger.fatal(`[Program bug] unexpectedly found v4 room ${roomLink(room.name)}`)
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
    const process = OperatingSystem.os.addProcess(processId => ObjectiveProcess.create(processId, roomName))
    const roomKeeperObjectiveType: LaunchableObjectiveType = "RoomKeeperObjective"
    process.didReceiveMessage(`add ${roomKeeperObjectiveType}`)
  }
}
