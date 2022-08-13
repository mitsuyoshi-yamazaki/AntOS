/**
 # IntrashardResourceWatchdog
 ## 概要
 Shard内Roomの資源配分を管理する

 ## WatchDog
 ### 目的
 - 必要な資源を利用できること
 - 損失を最小限に抑えること
   - Roomの喪失
   - 転送Energy

 ### 状態
 - Terminalに常に空きがある
 - おおよそ資源が分散管理されている
 - その部屋が必要とする資源がある
   - Energyはほとんど常に必要
 */

import { RoomResources } from "room_resource/room_resources"
import { RoomName } from "utility/room_name"
import { WatchDog, WatchDogState } from "./watchdog"

type ResourceErrorLackOfTerminalSpace = {
  readonly case: "lack of terminal space"
  readonly freeSpace: number
}
type ResourceErrorLackOfEnergy = {
  readonly case: "lack of energy"
  readonly totalEnergyAmount: number
}
type ResourceError = ResourceErrorLackOfTerminalSpace | ResourceErrorLackOfEnergy
type ResourceState = {
  readonly roomCount: number
  readonly errors: Map<RoomName, ResourceError[]>
}

export interface IntrashardResourceWatchdogState extends WatchDogState {

}

export class IntrashardResourceWatchdog implements WatchDog {
  private constructor(
  ) { }

  public encode(): IntrashardResourceWatchdogState {
    return {
      t: "IntrashardResourceWatchdog",
    }
  }

  public static decode(state: IntrashardResourceWatchdogState): IntrashardResourceWatchdog {
    return new IntrashardResourceWatchdog()
  }

  public static create(): IntrashardResourceWatchdog {
    return new IntrashardResourceWatchdog()
  }

  public getCurrentState(): ResourceState {
    const errors = new Map<RoomName, ResourceError[]>()
    const resources = RoomResources.getOwnedRoomResources()

    const requiredTerminalFreeCapacity = 20000 * 0.9
    const requiredTotalEnergyAmount = 100000 * 1.1

    resources.forEach(roomResource => {
      const roomErrors: ResourceError[] = []
      if (roomResource.activeStructures.terminal != null) {
        const freeSpace = roomResource.activeStructures.terminal.store.getFreeCapacity()
        if (freeSpace < requiredTerminalFreeCapacity) {
          roomErrors.push({
            case: "lack of terminal space",
            freeSpace,
          })
        }

        // Terminalのない低RCL部屋はenergyが不足することもあるため
        const energyAmount = roomResource.getResourceAmount(RESOURCE_ENERGY)
        if (energyAmount < requiredTotalEnergyAmount) {
          roomErrors.push({
            case: "lack of energy",
            totalEnergyAmount: energyAmount,
          })
        }
      }

      if (roomErrors.length <= 0) {
        return
      }
      errors.set(roomResource.room.name, roomErrors)
    })

    return {
      roomCount: resources.length,
      errors,
    }
  }

  public run(): void {
    // TODO:
  }
}
