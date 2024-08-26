import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "../../process_state"
import { ProcessDecoder } from "../../process_decoder"
import { FillNukerProcess } from "./fill_nuker_process"
import { coloredResourceType, roomLink } from "utility/log"
import { Timestamp } from "shared/utility/timestamp"
import { RoomName } from "shared/utility/room_name_types"
import { ResourceManager } from "utility/resource_manager"
import { SystemCalls } from "os/system_calls"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { RoomResources } from "room_resource/room_resources"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"

ProcessDecoder.register("NukerManagementProcess", state => {
  return NukerManagementProcess.decode(state as NukerManagementProcessState)
})

type FillNukerProcessInfo = {
  readonly processId: ProcessId
  readonly roomName: RoomName
}

interface NukerManagementProcessState extends ProcessState {
  readonly fillNukerProcessInfo: FillNukerProcessInfo | null
}

export class NukerManagementProcess implements Process, Procedural {
  public readonly identifier = "NukerManagementProcess"
  public get taskIdentifier(): string {
    return this.identifier
  }

  private sleepUntil: Timestamp | null = null

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private fillNukerProcessInfo: FillNukerProcessInfo | null,
  ) {
  }

  public encode(): NukerManagementProcessState {
    return {
      t: "NukerManagementProcess",
      l: this.launchTime,
      i: this.processId,
      fillNukerProcessInfo: this.fillNukerProcessInfo,
    }
  }

  public static decode(state: NukerManagementProcessState): NukerManagementProcess {
    return new NukerManagementProcess(state.l, state.i, state.fillNukerProcessInfo)
  }

  public static create(processId: ProcessId): NukerManagementProcess {
    return new NukerManagementProcess(Game.time, processId, null)
  }

  public processShortDescription(): string {
    const descriptions: string[] = []

    const fillNukerProcess = this.getFillNukerProcess()
    if (fillNukerProcess == null) {
      descriptions.push("stand by")
    } else {
      descriptions.push(`filling ${roomLink(fillNukerProcess.ownedRoomName)}`)
    }

    if (this.sleepUntil != null) {
      descriptions.push(`sleeping in ${this.sleepUntil - Game.time} ticks`)
    } else {
      descriptions.push("running")
    }

    return descriptions.join(", ")
  }

  public runOnTick(): void {
    if (this.sleepUntil != null) {
      if (this.sleepUntil > Game.time) {
        return
      }
      this.sleepUntil = null
    }

    const fillNukerProcess = this.getFillNukerProcess()
    if (fillNukerProcess != null) {
      this.sleepUntil = Game.time + 17
      return
    }

    this.fillNukerProcessInfo = null

    const targetInfo = this.getTargets()
    if (targetInfo == null) {
      this.sleepUntil = Game.time + 509
      return
    }

    const nukerRoomName = targetInfo.nuker.room.name
    const terminalInfo = targetInfo.senderTerminals.map(terminal => ({
      terminal,
      distance: Game.map.getRoomLinearDistance(terminal.room.name, nukerRoomName),
    }))
    terminalInfo.sort((lhs, rhs) => lhs.distance - rhs.distance)

    const requiredGhodiumAmount = targetInfo.nuker.store.getFreeCapacity(RESOURCE_GHODIUM)

    const sendResult = ((): true | { terminal: StructureTerminal, result: ReturnType<StructureTerminal["send"]> }[] => {
      const results: {terminal: StructureTerminal, result: ReturnType<StructureTerminal["send"]>}[] = []

      for (const terminal of terminalInfo) {
        const sendResult = terminal.terminal.send(RESOURCE_GHODIUM, requiredGhodiumAmount, targetInfo.nuker.room.name)
        if (sendResult === OK) {
          return true
        }
        results.push({
          terminal: terminal.terminal,
          result: sendResult,
        })
      }
      return results
    })()

    if (sendResult !== true) {
      const failureReason = sendResult.map(result => `- ${roomLink(result.terminal.room.name)}: ${result.result}`)
      PrimitiveLogger.programError(`${this.constructor.name} send ${coloredResourceType(RESOURCE_GHODIUM)} failed:\n${failureReason.join("\n")}`)
      this.sleepUntil = Game.time + 307
      return
    }

    const process = SystemCalls.systemCall()?.addProcess(this.processId, processId => {
      return FillNukerProcess.create(processId, targetInfo.nuker)
    })

    if (process == null) {
      PrimitiveLogger.programError(`${this.constructor.name} cannot add FillNukerProcess`)
      this.sleepUntil = Game.time + 307
      return
    }

    this.fillNukerProcessInfo = {
      processId: process.processId,
      roomName: process.ownedRoomName,
    }
  }

  private getTargets(): {nuker: StructureNuker, senderTerminals: StructureTerminal[]} | null {
    const roomNamesWithGhodium = ResourceManager.resourceInRoom(RESOURCE_GHODIUM)
    let targetNuker: StructureNuker | null = null
    const senderTerminals: StructureTerminal[] = []

    // Gを持つTerminalをリストアップ
    for (const [roomName, amount] of roomNamesWithGhodium.entries()) {
      const roomResource = RoomResources.getOwnedRoomResource(roomName)
      if (roomResource == null) {
        continue
      }

      const terminal = this.sendableTerminalIn(roomResource)
      if (terminal != null) {
        senderTerminals.push(terminal)
      }

      const nuker = roomResource.activeStructures.nuker
      if (nuker == null) {
        continue
      }
      const requiredGhodium = nuker.store.getFreeCapacity(RESOURCE_GHODIUM)
      if (targetNuker == null) {
        if (requiredGhodium > 0 && requiredGhodium < amount) {
          targetNuker = nuker
        }
      }
    }

    if (targetNuker != null && senderTerminals.length > 0) {
      console.log(`HOGE1 nuker in ${targetNuker.room.name} from ${senderTerminals.map(t => t.room.name).join(",")}`)
      return {
        nuker: targetNuker,
        senderTerminals,
      }
    }

    for (const roomResource of RoomResources.getOwnedRoomResources()) {
      const nuker = roomResource?.activeStructures.nuker
      if (nuker == null) {
        continue
      }
      const requiredGhodiumAmount = nuker.store.getFreeCapacity(RESOURCE_GHODIUM)
      if (requiredGhodiumAmount > 0) {
        console.log(`HOGE2 nuker in ${nuker.room.name} from ${senderTerminals.map(t => t.room.name).join(",")}`)
        return {
          nuker,
          senderTerminals,
        }
      }
    }

    return null
  }

  private sendableTerminalIn(roomResource: OwnedRoomResource): StructureTerminal | null {
    const terminal = roomResource.activeStructures.terminal
    if (terminal == null) {
      return null
    }
    if (terminal.cooldown > 0) {
      return null
    }
    if (terminal.store.getUsedCapacity(RESOURCE_GHODIUM) < 5000) {
      return null
    }
    if (terminal.store.getUsedCapacity(RESOURCE_ENERGY) < 30000) {
      return null
    }
    return terminal
  }

  private getFillNukerProcess(): FillNukerProcess | null {
    if (this.fillNukerProcessInfo == null) {
      return null
    }
    return SystemCalls.systemCall()?.processOf(this.fillNukerProcessInfo.processId) as FillNukerProcess | null
  }
}
