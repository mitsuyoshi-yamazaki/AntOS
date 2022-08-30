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

 ### 正常状態
 - Terminalに常に空きがある
 - おおよそ資源が分散管理されている
 - その部屋が必要とする資源がある
   - Energyはほとんど常に必要

 ### 異常状態
 ※ 正常状態とどのような点で逆かが定義される

 - Terminalに空きがない
 - 一部屋に同一の資源が大量にある
 - その部屋が必要とする資源がない
   - Energyはほとんど常に必要

 ### 異常状態の修正
 ※ Terminal.send()のみによって解決するという立場をとる

 - Terminalに空きがない
   - 他の部屋へ送る
 - 一部屋に同一の資源が大量にある
   - 他の部屋へ送る
 - その部屋が必要とする資源がない
   - 他の部屋から送る

 ## Discussion
 - 問題（正常状態）の認識には、なぜそれが正常なのかという理解が必要
   - 問題-解決法が循環する場合、俯瞰的に解決法を探す手法が必要
     - 解決法を試したのちの状態がどうなるか推定すればよいのでは
 - 不足・余剰を単に破棄/購入などすれば面倒な計算を系の外部に排除できるのではないか
   - 不足・余剰そのものが新たな異常である
 - [優先度低] 転送コストの最小化は、Sector内/Sector外で計算すればある程度減らせるのではないか
 - Terminalの役割に対する不備
   - 資源を受け取れない
     - 空き容量不足
   - 資源を送れない
     - エネルギー不足

 ## TODO
 - 一旦DistributorProcessはそうあるものと考えてterminal.send()のみ行う
 - terminalの資源数を表すオブジェクトに変換し、タスクを洗い出し、実行後の状態を検証する
 */

import { RoomResources } from "room_resource/room_resources"
import { coloredResourceType } from "utility/log"
import { RoomName } from "utility/room_name"
import { Timestamp } from "utility/timestamp"
import { WatchDog, WatchDogState } from "./watchdog"

type ResourceErrorLackOfTerminalSpace = {
  readonly case: "lack of terminal space"
  readonly freeSpace: number
}
type ResourceErrorLackOfTerminalEnergySpace = {
  readonly case: "lack of terminal energy space"
  readonly energySpace: number
  readonly freeSpace: number
}
type ResourceErrorLackOfEnergy = {
  readonly case: "lack of energy"
  readonly totalEnergyAmount: number
}
type ResourceError = ResourceErrorLackOfTerminalSpace | ResourceErrorLackOfTerminalEnergySpace | ResourceErrorLackOfEnergy
type ResourceErrorDetail = {
  readonly terminal: StructureTerminal
  readonly errors: ResourceError[]
}
type ResourceState = {
  readonly roomCount: number
  readonly errors: Map<RoomName, ResourceErrorDetail>
}

type ResolveAction = {
  readonly case: "send" | "receive"
  readonly resourceType: ResourceConstant
  readonly amount: number
}
type SendResourceTask = {
  readonly case: "send resource"
  readonly from: RoomName
  readonly to: RoomName
  readonly resourceType: ResourceConstant
  readonly amount: number
}

type ResolveActionIncompleteError = {
  readonly case: "resolve action incomplete"
  readonly action: ResolveAction
  readonly reason: string
  readonly roomName: RoomName
}
type ExpectedResourceError = ResourceError | ResolveActionIncompleteError
type ResolveTask = SendResourceTask | ResolveActionIncompleteError

const requiredTerminalFreeCapacity = 20000 * 0.9
const requiredTerminalEnergySpace = 100000
const requiredTotalEnergyAmount = 100000 * 1.1

export interface IntrashardResourceWatchdogState extends WatchDogState {
  readonly sendResourceTasks: SendResourceTask[]
  readonly nextRun: Timestamp
}

export class IntrashardResourceWatchdog implements WatchDog {
  private constructor(
    private readonly sendResourceTasks: SendResourceTask[],
    private nextRun: Timestamp,
  ) { }

  public encode(): IntrashardResourceWatchdogState {
    return {
      t: "IntrashardResourceWatchdog",
      sendResourceTasks: this.sendResourceTasks,
      nextRun: this.nextRun,
    }
  }

  public static decode(state: IntrashardResourceWatchdogState): IntrashardResourceWatchdog {
    return new IntrashardResourceWatchdog(
      state.sendResourceTasks ?? [],
      state.nextRun ?? (Game.time + 1),
    )
  }

  public static create(): IntrashardResourceWatchdog {
    return new IntrashardResourceWatchdog(
      [],
      Game.time + 1,
    )
  }

  public getCurrentState(): ResourceState {
    const errors = new Map<RoomName, ResourceErrorDetail>()
    const resources = RoomResources.getOwnedRoomResources()

    resources.forEach(roomResource => {
      const terminal = roomResource.activeStructures.terminal
      if (terminal == null) {
        return
      }

      const roomErrors = this.getErrorsOf(terminal)
      if (roomErrors.length <= 0) {
        return
      }
      errors.set(roomResource.room.name, {
        terminal,
        errors: roomErrors,
      })
    })

    return {
      roomCount: resources.length,
      errors,
    }
  }

  public dryRun(): ResolveTask[] {
    return this.solve(this.getCurrentState().errors)
  }

  public run(): void {
    // this.calculateResourceDistribution()
  }

  private solve(errors: Map<RoomName, ResourceErrorDetail>): ResolveTask[] {
    return Array.from(errors.values())
      .flatMap((errorDetail): ResolveTask[] =>
        this.resolveTasks(this.solveActions(errorDetail.errors, errorDetail.terminal))
      )
  }

  private solveActions(errors: ResourceError[], terminal: StructureTerminal): ResolveAction[] {
    return errors.flatMap((error): ResolveAction[] => {
      switch (error.case) {
      case "lack of terminal space":
        return this.sendableResourceTypes(terminal, requiredTerminalFreeCapacity - error.freeSpace).map((resource): ResolveAction => {
          return {
            case: "send",
            ...resource,
          }
        })

      case "lack of terminal energy space":
        // TODO: なんでもよいので容量を空ける、は困難なので後回し
        return []

      case "lack of energy":
        return [{
          case: "receive",
          resourceType: RESOURCE_ENERGY,
          amount: requiredTotalEnergyAmount - error.totalEnergyAmount
        }]

      default: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _: never = error
        return []
      }
      }
    })
  }

  private sendableResourceTypes(terminal: StructureTerminal, sendAmount: number): { resourceType: ResourceConstant, amount: number }[] {
    let requiredFreeSpace = sendAmount
    const results: { resourceType: ResourceConstant, amount: number }[] = []

    const energyAmount = terminal.store.getUsedCapacity(RESOURCE_ENERGY)
    const sendableEnergyAmount = (terminal.store.getCapacity() * 0.6) - energyAmount
    if (sendableEnergyAmount > 0) {
      if (sendableEnergyAmount >= requiredFreeSpace) {
        return [{
          resourceType: RESOURCE_ENERGY,
          amount: requiredFreeSpace,
        }]
      } else {
        results.push({
          resourceType: RESOURCE_ENERGY,
          amount: sendableEnergyAmount,
        })
        requiredFreeSpace -= sendableEnergyAmount
      }
    }

    const sendableResourceMinimumAmount = 20000
    const sendableResourceTypes = Array.from((Object.entries(terminal.store) as [ResourceConstant, number][]))
      .filter(([, amount]) => amount >= sendableResourceMinimumAmount)
      .sort((lhs, rhs) => rhs[1] - lhs[1])

    for (const resource of sendableResourceTypes) {
      const amount = Math.min(resource[1], requiredFreeSpace)
      results.push({
        resourceType: resource[0],
        amount,
      })

      requiredFreeSpace -= amount
      if (requiredFreeSpace <= 0) {
        return results
      }
    }
    return results
  }

  private resolveTasks(actions: ResolveAction[]): ResolveTask[] {
    return actions // TODO: どこからどこへ？
  }

  /**
   * actionsを先頭から実行していき、
   * - 実行不能なactionが登場した場合：その時点で発生している ResourceError と ResolveActionIncompleteError を返す
   * - 全て実行できた場合：その時点で発生している ResourceError を返す
   */
  private errorsAfterAction(terminal: StructureTerminal, actions: ResolveAction[]): ExpectedResourceError[] {
    const capacity = terminal.store.getCapacity()
    const resources = this.getResourceMapOf(terminal)
    const errors: ExpectedResourceError[] = []

    const maxResourceTransferCost = (resourceAmount: number): number => resourceAmount

    for (const action of actions) {
      switch (action.case) {
      case "send": {
        const resourceAmount = resources.get(action.resourceType) ?? 0
        const updatedResourceAmount = action.amount - resourceAmount
        if (updatedResourceAmount < 0) {
          errors.push({
            case: "resolve action incomplete",
            action,
            reason: `no enough ${coloredResourceType(action.resourceType)} (${resourceAmount} - ${action.amount} < 0)`,
            roomName: terminal.room.name,
          })
          return errors
        }
        resources.set(action.resourceType, updatedResourceAmount)

        const energyAmount = resources.get(RESOURCE_ENERGY) ?? 0
        const transferCost = maxResourceTransferCost(action.amount)
        const updatedEnergyAmount = energyAmount - transferCost
        if (updatedEnergyAmount < 0) {
          errors.push({
            case: "resolve action incomplete",
            action,
            reason: `no enough ${coloredResourceType(RESOURCE_ENERGY)} for sending ${coloredResourceType(action.resourceType)} (${energyAmount} - ${transferCost} < 0)`,
            roomName: terminal.room.name,
          })
          return errors
        }
        resources.set(RESOURCE_ENERGY, updatedEnergyAmount)
        break
      }
      case "receive": {
        const resourceAmount = resources.get(action.resourceType) ?? 0
        const updatedResourceAmount = resourceAmount + action.amount

        const totalAmount = Array.from(resources.values()).reduce((result, current) => result + current, 0)
        if (totalAmount > capacity) {
          errors.push({
            case: "resolve action incomplete",
            action,
            reason: `no enough empty space for receiving ${action.amount} ${coloredResourceType(action.resourceType)}`,
            roomName: terminal.room.name,
          })
          return errors
        }
        resources.set(action.resourceType, updatedResourceAmount)
        break
      }
      default: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _: never = action.case
        break
      }
      }
    }

    errors.push(...this.getErrorsOf(resources, capacity))
    return errors
  }

  private getErrorsOf(terminal: StructureTerminal): ResourceError[]
  private getErrorsOf(resources: Map<ResourceConstant, number>, capacity: number): ResourceError[]
  private getErrorsOf(...args: [StructureTerminal] | [Map<ResourceConstant, number>, number]): ResourceError[] {
    const [resources, capacity] = ((): [Map<ResourceConstant, number>, number] => {
      if (args[0] instanceof StructureTerminal) {
        return [this.getResourceMapOf(args[0]), args[0].store.getCapacity()]
      }
      return args as [Map<ResourceConstant, number>, number]
    })()
    const errors: ResourceError[] = []

    const totalAmount = Array.from(resources.values()).reduce((result, current) => result + current, 0)
    const freeSpace = capacity - totalAmount
    if (freeSpace < requiredTerminalFreeCapacity) {
      errors.push({
        case: "lack of terminal space",
        freeSpace,
      })
    }

    const energyAmount = resources.get(RESOURCE_ENERGY) ?? 0
    if (energyAmount < requiredTotalEnergyAmount) {
      errors.push({
        case: "lack of energy",
        totalEnergyAmount: energyAmount,
      })
    }

    const energySpace = energyAmount + freeSpace
    if (energySpace < requiredTerminalEnergySpace) {
      errors.push({
        case: "lack of terminal energy space",
        freeSpace,
        energySpace,
      })
    }

    return errors
  }

  private getResourceMapOf(terminal: StructureTerminal): Map<ResourceConstant, number> {
    return new Map(Object.entries(terminal.store) as [ResourceConstant, number][])
  }
}
