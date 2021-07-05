import { RoomKeeperObjective } from "old_objective/room_keeper/room_keeper_objective"
import { RoomKeeperProcess } from "old_objective/room_keeper/room_keeper_process"
import { OperatingSystem, ProcessInfo } from "os/os"
import { isV4CreepMemory, V4CreepMemory } from "prototype/creep"
import { RoomName } from "prototype/room"
import { Migration } from "utility/migration"
import { ShortVersion } from "utility/system_info"
import { World } from "world_info/world_info"
import { CreepType } from "_old/creep"

export class V4ApplicationProcessLauncher {
  public launchProcess(): void {
    const allProcessInfo = OperatingSystem.os.listAllProcesses()
    this.roomsNeedKeeper(allProcessInfo).forEach(roomName => this.launchRoomKeeperProcess(roomName))
  }

  private roomsNeedKeeper(allProcessInfo: ProcessInfo[]): RoomName[] {
    if (World.isSimulation()) {
      return []
    }

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
      if (Migration.roomVersion(roomName) !== ShortVersion.v4) {
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
}
