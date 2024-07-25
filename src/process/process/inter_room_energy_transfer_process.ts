import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredResourceType, coloredText, roomLink, shortenedNumber } from "utility/log"
import { ProcessState } from "../process_state"
import { RoomResources } from "room_resource/room_resources"
import { processLog } from "os/infrastructure/logger"
import { ProcessDecoder } from "process/process_decoder"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { RoomName } from "shared/utility/room_name_types"

ProcessDecoder.register("InterRoomEnergyTransferProcess", state => {
  return InterRoomEnergyTransferProcess.decode(state as InterRoomEnergyTransferProcessState)
})

export interface InterRoomEnergyTransferProcessState extends ProcessState {
}

const Constants = {
  maximumEnergyAmount: 800000,  // 800k
  minimumEnergyAmount: 100000,  // 100k
  requiredFreeSpace: 40000,     // 40k
  terminalMinimumFreeSpace: 6000
} as const

type RoomInfo = {
  readonly roomResource: OwnedRoomResource
  readonly terminal: StructureTerminal
  readonly storage: StructureStorage
  readonly totalEnergyAmount: number
}
type ExcessEnergyRoomInfo = RoomInfo & {
  energyAmountInTerminal: number
  excessEnergyAmountInTerminal: number // including transfer fee
  sent: boolean
}
type EnergyShortageRoomInfo = RoomInfo & {
  terminalFreeSpace: number
}
type EnergyReceivableRoomInfo = RoomInfo & {
  readonly energyRatio: number
  terminalFreeSpace: number
}

export class InterRoomEnergyTransferProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): InterRoomEnergyTransferProcessState {
    return {
      t: "InterRoomEnergyTransferProcess",
      l: this.launchTime,
      i: this.processId,
    }
  }

  public static decode(state: InterRoomEnergyTransferProcessState): InterRoomEnergyTransferProcess {
    return new InterRoomEnergyTransferProcess(state.l, state.i)
  }

  public static create(processId: ProcessId): InterRoomEnergyTransferProcess {
    return new InterRoomEnergyTransferProcess(Game.time, processId)
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "run_manually"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "test": {
        const logs: string[] = this.run({ test: true })
        return `Testing result:\n${logs.join("\n")}`
      }

      case "run_manually": {
        const logs: string[] = this.run()
        return `Result:\n${logs.join("\n")}`
      }

      default:
        throw `Invalid command ${commandList}. see "help"`
      }
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }

  public runOnTick(): void {
    if ((Game.time % 149) !== 19) {
      return
    }
    if ((Game.time % 359) === 17) {
      return  // InterRoomResourceManagementProcess 干渉防止
    }

    const logs: string[] = this.run()
    logs.forEach(log => processLog(this, log))
  }

  // Private
  private run(options?: { test?: true }): string[] {
    const logs: string[] = []

    const { excessEnergyRooms, energyShortageRooms, energyReceivableRooms, failureLogs } = this.getRooms()
    logs.push(...failureLogs)
    logs.push(...this.send(excessEnergyRooms, energyShortageRooms, energyReceivableRooms, options))

    if (logs.length <= 0) {
      logs.push("No energy transfer")
    }
    logs.push(`Energy exceeded rooms: ${excessEnergyRooms.map(room => roomLink(room.roomResource.room.name)).join(", ")}`)

    return logs
  }

  private send(excessEnergyRooms: ExcessEnergyRoomInfo[], energyShortageRooms: EnergyShortageRoomInfo[], energyReceivableRooms: EnergyReceivableRoomInfo[], options?: {test?: true}): string[] {
    const results: string[] = []

    excessEnergyRooms.sort((lhs, rhs) => rhs.excessEnergyAmountInTerminal - lhs.excessEnergyAmountInTerminal)
    const send = (roomInfo: ExcessEnergyRoomInfo, roomName: RoomName, sendAmount: number): ScreepsReturnCode => {
      if (options?.test === true) {
        return OK
      }
      return roomInfo.terminal.send(RESOURCE_ENERGY, sendAmount, roomName)
    }

    excessEnergyRooms.forEach(roomInfo => {
      if (roomInfo.sent === true) {
        return
      }

      const priorities = energyShortageRooms.map((shortageRoomInfo): { shortageRoomInfo: EnergyShortageRoomInfo, priority: number } => {
        const distance = Game.map.getRoomLinearDistance(roomInfo.roomResource.room.name, shortageRoomInfo.roomResource.room.name)
        const normalizedDistance = distance / 20
        const normalizedRequiredEnergy = shortageRoomInfo.totalEnergyAmount / 100000

        return {
          shortageRoomInfo,
          priority: normalizedDistance + normalizedRequiredEnergy,  // 小さい方が優先
        }
      })

      priorities.sort((lhs, rhs) => lhs.priority - rhs.priority)

      for (const { shortageRoomInfo } of priorities) {
        const receivableEnergyAmount = shortageRoomInfo.terminalFreeSpace - Constants.terminalMinimumFreeSpace
        if (receivableEnergyAmount < 4000) {
          continue
        }

        const sendAmount = Math.min(Math.floor(roomInfo.energyAmountInTerminal / 2), receivableEnergyAmount)
        if (sendAmount < 3000) {
          continue
        }

        const sendResult = send(roomInfo, shortageRoomInfo.roomResource.room.name, sendAmount)
        switch (sendResult) {
        case OK:
          roomInfo.energyAmountInTerminal -= (sendAmount * 2)
          roomInfo.sent = true
          shortageRoomInfo.terminalFreeSpace -= sendAmount
          results.push(`[s] Sent ${coloredText(`${sendAmount}`, "info")} ${coloredResourceType(RESOURCE_ENERGY)} from ${roomLink(roomInfo.roomResource.room.name)} (remaining ${shortenedNumber(roomInfo.energyAmountInTerminal)} ${coloredResourceType(RESOURCE_ENERGY)}) to ${roomLink(shortageRoomInfo.roomResource.room.name)} (${shortenedNumber(shortageRoomInfo.terminalFreeSpace)} free space)`)
          return

        default:
          results.push(`[s] Failed (${sendResult}) ${coloredText(`${sendAmount}`, "info")} ${coloredResourceType(RESOURCE_ENERGY)} from ${roomLink(roomInfo.roomResource.room.name)} to ${roomLink(shortageRoomInfo.roomResource.room.name)}`)
          continue
        }
      }
    })

    excessEnergyRooms.forEach(roomInfo => {
      if (roomInfo.sent === true) {
        return
      }

      const priorities = energyReceivableRooms.map((receivableRoomInfo): { receivableRoomInfo: EnergyReceivableRoomInfo, priority: number } => {
        const distance = Game.map.getRoomLinearDistance(roomInfo.roomResource.room.name, receivableRoomInfo.roomResource.room.name)
        const normalizedDistance = distance / 20
        const normalizedEnergyRatio = receivableRoomInfo.energyRatio

        return {
          receivableRoomInfo,
          priority: normalizedDistance + normalizedEnergyRatio,  // 小さい方が優先
        }
      })

      priorities.sort((lhs, rhs) => lhs.priority - rhs.priority)

      for (const { receivableRoomInfo } of priorities) {
        const receivableEnergyAmount = receivableRoomInfo.terminalFreeSpace - Constants.terminalMinimumFreeSpace
        if (receivableEnergyAmount < 4000) {
          continue
        }

        const sendAmount = Math.min(Math.floor(roomInfo.energyAmountInTerminal / 2), receivableEnergyAmount)
        if (sendAmount < 3000) {
          continue
        }

        const sendResult = send(roomInfo, receivableRoomInfo.roomResource.room.name, sendAmount)
        switch (sendResult) {
        case OK:
          roomInfo.energyAmountInTerminal -= (sendAmount * 2)
          roomInfo.sent = true
          receivableRoomInfo.terminalFreeSpace -= sendAmount
          results.push(`[r] Sent ${coloredText(`${sendAmount}`, "info")} ${coloredResourceType(RESOURCE_ENERGY)} from ${roomLink(roomInfo.roomResource.room.name)} (remaining ${shortenedNumber(roomInfo.energyAmountInTerminal)} ${coloredResourceType(RESOURCE_ENERGY)}) to ${roomLink(receivableRoomInfo.roomResource.room.name)} (${shortenedNumber(receivableRoomInfo.terminalFreeSpace)} free space)`)
          return

        default:
          results.push(`[r] Failed (${sendResult}) ${coloredText(`${sendAmount}`, "info")} ${coloredResourceType(RESOURCE_ENERGY)} from ${roomLink(roomInfo.roomResource.room.name)} to ${roomLink(receivableRoomInfo.roomResource.room.name)}`)
          continue
        }
      }
    })

    return results
  }

  private getRooms(): { excessEnergyRooms: ExcessEnergyRoomInfo[], energyShortageRooms: EnergyShortageRoomInfo[], energyReceivableRooms: EnergyReceivableRoomInfo[], failureLogs: string[] } {

    const excessEnergyRooms: ExcessEnergyRoomInfo[] = []
    const energyShortageRooms: EnergyShortageRoomInfo[] = []
    const energyReceivableRooms: EnergyReceivableRoomInfo[] = []
    const failureLogs: string[] = []

    const halfMaximumEnergyAmount = Constants.maximumEnergyAmount / 2
    const thirdMaximumEnergyAmount = Constants.maximumEnergyAmount / 3

    RoomResources.getOwnedRoomResources().forEach(roomResource => {
      if (roomResource.controller.level < 6) {
        return
      }

      const terminal = roomResource.activeStructures.terminal
      const storage = roomResource.activeStructures.storage
      if (terminal == null) {
        return
      }
      if (storage == null) {
        return
      }

      const energyAmountInTerminal = terminal.store.getUsedCapacity(RESOURCE_ENERGY)
      const terminalFreeSpace = terminal.store.getFreeCapacity()
      const totalFreeSpace = terminalFreeSpace + storage.store.getFreeCapacity()
      const totalEnergyAmount = energyAmountInTerminal + storage.store.getUsedCapacity(RESOURCE_ENERGY)

      if (terminal.cooldown <= 0) {
        if (totalEnergyAmount >= Constants.maximumEnergyAmount) {
          const excessEnergyAmountInTerminal = Math.min(totalEnergyAmount - Constants.maximumEnergyAmount, energyAmountInTerminal)

          if (excessEnergyAmountInTerminal > 20000) { // 20k
            excessEnergyRooms.push({
              roomResource,
              terminal,
              storage,
              totalEnergyAmount,
              energyAmountInTerminal,
              excessEnergyAmountInTerminal,
              sent: false,
            })
          }
          return
        }

        if (totalEnergyAmount >= halfMaximumEnergyAmount && totalFreeSpace < Constants.requiredFreeSpace) {
          const excessEnergyAmountInTerminal = Math.min(totalEnergyAmount - halfMaximumEnergyAmount, energyAmountInTerminal)

          if (excessEnergyAmountInTerminal > 20000) { // 20k
            excessEnergyRooms.push({
              roomResource,
              terminal,
              storage,
              totalEnergyAmount,
              energyAmountInTerminal,
              excessEnergyAmountInTerminal,
              sent: false,
            })
          }
          return
        }
      }

      if (totalEnergyAmount < Constants.minimumEnergyAmount) {
        if (totalFreeSpace < Constants.requiredFreeSpace) {
          failureLogs.push(`${roomLink(roomResource.room.name)} lack of energy (${shortenedNumber(totalEnergyAmount)}) but also lack of total free space (${shortenedNumber(totalFreeSpace)})`)
        } else {
          energyShortageRooms.push({
            roomResource,
            terminal,
            storage,
            totalEnergyAmount,
            terminalFreeSpace,
          })
        }
        return
      }

      const totalResourceAmount = terminal.store.getUsedCapacity() + storage.store.getUsedCapacity()
      const energyRatio = totalEnergyAmount / totalResourceAmount

      if (energyRatio < 0.4 && totalEnergyAmount < thirdMaximumEnergyAmount && totalFreeSpace > (Constants.requiredFreeSpace * 2)) {
        energyReceivableRooms.push({
          roomResource,
          terminal,
          storage,
          totalEnergyAmount,
          terminalFreeSpace,
          energyRatio,
        })
        return
      }
    })

    return {
      excessEnergyRooms,
      energyShortageRooms,
      energyReceivableRooms,
      failureLogs,
    }
  }
}
