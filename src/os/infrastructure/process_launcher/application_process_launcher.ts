import { LaunchableObjectiveType } from "objective/objective"
import { RoomKeeperObjective } from "old_objective/room_keeper/room_keeper_objective"
import { RoomKeeperProcess } from "old_objective/room_keeper/room_keeper_process"
import { OperatingSystem } from "os/os"
import { ObjectiveProcess } from "process/objective_process"
import { isV4CreepMemory, V4CreepMemory } from "prototype/creep"
import { RoomName } from "prototype/room"
import { Migration } from "utility/migration"
import { ShortVersion } from "utility/system_info"
import { World } from "world_info/world_info"
import { CreepType } from "_old/creep"

export class ApplicationProcessLauncher {
  public launchProcess(): void {
    const allProcessInfo = OperatingSystem.os.listAllProcesses()
    const roomsWithV4KeeperProcess = allProcessInfo.map(processInfo => {
      if (processInfo.process instanceof RoomKeeperProcess) {
        return processInfo.process.roomName
      }
      return null
    })
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
        if (roomsWithV4KeeperProcess.includes(room.name) === true) {
          return
        }
        this.launchV4RoomKeeperProcess(room.name)
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

  private launchV4RoomKeeperProcess(roomName: RoomName): void {
    const time = Game.time
    const workers = ((): Creep[] => {
      const room = Game.rooms[roomName]
      if (room == null) {
        return []
      }
      return room
        .find(FIND_MY_CREEPS).filter(creep => {
          if (!isV4CreepMemory(creep.memory)) {
            return false
          }
          if (creep.memory.type !== CreepType.TAKE_OVER) {
            return false
          }
          if (creep.body.map(b => b.type).includes(WORK) !== true) {
            return false
          }
          return true
        })
    })()
    workers.forEach(creep => (creep.memory as V4CreepMemory).type = CreepType.WORKER)
    const workerNames = workers.map(creep => creep.name)
    const objective = new RoomKeeperObjective(time, [], roomName, workerNames)
    OperatingSystem.os.addProcess(processId => new RoomKeeperProcess(time, processId, objective))
  }

  private launchV5RoomKeeperProcess(roomName: RoomName): void {
    const process = OperatingSystem.os.addProcess(processId => ObjectiveProcess.create(processId, roomName))
    const roomKeeperObjectiveType: LaunchableObjectiveType = "RoomKeeperObjective"
    process.didReceiveMessage(`add ${roomKeeperObjectiveType}`)
  }
}
