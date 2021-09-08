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
import { Season487837AttackInvaderCoreProcess } from "process/temporary/season_487837_attack_invader_core_process"
import { World35588848GclManagerProcess } from "process/temporary/world_35588848_gcl_manager_process"
import { Environment } from "utility/environment"
import { ValuedArrayMap } from "utility/valued_collection"
import { PrioritizerProcess } from "process/application/prioritizer_process"

export class ApplicationProcessLauncher {
  public launchProcess(processList: Process[], processLauncher: ProcessLauncher): void {
    const roomKeeperMap = new ValuedArrayMap<ShortVersion, RoomName>()
    let hasBootstrapManagerProcess = false as boolean
    let hasAttackInvaderCoreProcess = false as boolean
    let hasGclManagerProcess = false as boolean
    let hasPrioritizerProcess = false as boolean

    processList.forEach(process => {
      if (process instanceof RoomKeeperProcess) {
        roomKeeperMap.getValueFor(ShortVersion.v5).push(process.roomName)
      }
      if (process instanceof V6RoomKeeperProcess) {
        roomKeeperMap.getValueFor(ShortVersion.v6).push(process.roomName)
      }
      if (process instanceof BootstrapRoomManagerProcess) {
        hasBootstrapManagerProcess = true
      }
      if (process instanceof Season487837AttackInvaderCoreProcess) {
        hasAttackInvaderCoreProcess = true
      }
      if (process instanceof World35588848GclManagerProcess) {
        hasGclManagerProcess = true
      }
      if (process instanceof PrioritizerProcess) {
        hasPrioritizerProcess = true
      }
    })

    this.checkRoomKeeperProcess(roomKeeperMap, processLauncher)
    if (hasBootstrapManagerProcess !== true) {
      this.launchBoostrapRoomManagerProcess(processLauncher)
    }
    if (hasAttackInvaderCoreProcess !== true) {
      this.launchAttackInvaderCoreProcess(processLauncher)
    }
    if (Environment.isAutomatic() === true && hasGclManagerProcess !== true) {
      this.launchGCLManagerProcess(processLauncher)
    }
    if (hasPrioritizerProcess !== true) {
      this.launchPrioritizerProcess(processLauncher)
    }
  }

  private checkRoomKeeperProcess(roomKeeperMap: Map<ShortVersion, RoomName[]>, processLauncher: ProcessLauncher): void {
    const roomsWithV5KeeperProcess = roomKeeperMap.get(ShortVersion.v5) ?? []
    const roomsWithV6KeeperProcess = roomKeeperMap.get(ShortVersion.v6) ?? []

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

  private launchBoostrapRoomManagerProcess(processLauncher: ProcessLauncher): void {
    processLauncher(null, processId => BootstrapRoomManagerProcess.create(processId))
  }

  private launchAttackInvaderCoreProcess(processLauncher: ProcessLauncher): void {
    processLauncher(null, processId => Season487837AttackInvaderCoreProcess.create(processId))
  }

  private launchGCLManagerProcess(processLauncher: ProcessLauncher): void {
    processLauncher(null, processId => World35588848GclManagerProcess.create(processId))
  }

  private launchPrioritizerProcess(processLauncher: ProcessLauncher): void {
    processLauncher(null, processId => PrioritizerProcess.create(processId))
  }
}
