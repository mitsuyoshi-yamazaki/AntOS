import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "process/process_state"
import { generateCodename } from "utility/unique_id"
import { ProcessDecoder } from "process/process_decoder"
import type { RoomName } from "shared/utility/room_name_types"
import { SectorName } from "shared/utility/room_sector"
import { State, Stateful } from "os/infrastructure/state"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Timestamp } from "shared/utility/timestamp"
import { ScoutRoomProcess } from "process/onetime/scout_room_process"
import { OperatingSystem } from "os/os"

type DeclarationIdentifier = string

/**
 * - Declaration - Action - 具体Action
 *   - Action: Observe roomなど
 *   - 具体Action: send scoutなど
 * - ライフサイクル
 *   - Declarationの生成
 *   - Declarationの分解
 *   - Actionの決定
 *   - Actionのキューイング
 *   - 具体Actionの実行
 */
/**
 * - 例: W46S8に自分のsignを設定する（one time
 *   - Observe room
 *     - observe()
 *   - Send scout
 *   - sign
 *   - 終了
 */
/**
 * - その他
 *   - 柔軟性のあるCreepはタスク遂行中の新タスク追加に対応可能
 */

type DeclarationContainerState = {
  readonly declarationState: DeclarationState
  readonly retainCount: number
}

class DeclarationContainer {
  public get retainCount(): number {
    return this._retainCount
  }

  private _retainCount: number

  public constructor(
    public readonly declaration: Declaration,
    retainCount: number
  ) {
    this._retainCount = retainCount
  }

  public retain(): void {
    this._retainCount += 1
  }

  public release(): void {
    if (this._retainCount <= 0) {
      PrimitiveLogger.programError(`DeclarationContainer.release() trying to release reseased declaration ${this.declaration.identifier}`)
      return
    }
    this._retainCount -= 1
  }
}

type DeclarationFinishCondition = "one time" | "continuous"

type DeclarationProgressInProgress = {
  readonly declarationProgress: "in progress"
  readonly status: string
}
type DeclarationProgressFinished = {
  readonly declarationProgress: "finished"
}
type DeclarationProgressFailed = {
  readonly declarationProgress: "failed"
  readonly reason: string
}
type DeclarationProgress = DeclarationProgressInProgress | DeclarationProgressFinished | DeclarationProgressFailed


interface DeclarationState extends State {
  readonly launchTime: Timestamp
  readonly finishCondition: DeclarationFinishCondition
}

interface Declaration extends Stateful {
  readonly identifier: DeclarationIdentifier
  readonly launchTime: Timestamp
  readonly finishCondition: DeclarationFinishCondition
  readonly progress: DeclarationProgress

  runOnTick(): void
}

ProcessDecoder.register("World35872159TestDeclarationProcess", state => {
  return World35872159TestDeclarationProcess.decode(state as World35872159TestDeclarationProcessState)
})

export interface World35872159TestDeclarationProcessState extends ProcessState {
  readonly declarations: Declaration[]
}

export class World35872159TestDeclarationProcess implements Process, Procedural {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly declarations: Declaration[],
  ) {
    this.identifier = `${this.constructor.name}_${this.launchTime}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): World35872159TestDeclarationProcessState {
    return {
      t: "World35872159TestDeclarationProcess",
      l: this.launchTime,
      i: this.processId,
      declarations: this.declarations,
    }
  }

  public static decode(state: World35872159TestDeclarationProcessState): World35872159TestDeclarationProcess {
    return new World35872159TestDeclarationProcess(state.l, state.i, state.declarations)
  }

  public static create(processId: ProcessId): World35872159TestDeclarationProcess {
    return new World35872159TestDeclarationProcess(Game.time, processId, [])
  }

  public processShortDescription(): string {
    return `${this.declarations} declarations`
  }

  // public processDescription(): string {
  //   return `Declarations:\n${this.declarations.map(declaration => `- ${declaration.declarationType}`).join("\n")}`
  // }

  public runOnTick(): void {
    /**
     * - observeはobserverを使う方式とscoutを派遣する方式のふたつがあり、どちらを採用すべきかはProcessからはわからないため、resource poolまで"observe declaration"を渡す
     */
  }

  // private addDeclaration(declaration: Declaration): void {
  //   switch (declaration.declarationType) {
  //   case "sign":
  //     this.addSignDeclaration(declaration)
  //     break
  //   }
  // }

  // private addSignDeclaration(declaration: SignDeclaration): void {
  //   const targetRoom = Game.rooms[declaration.targetRoomName]
  //   if (targetRoom != null) {
  //     if (targetRoom.controller == null) {
  //       // TODO: invalid declaration
  //       return
  //     }
  //     if (targetRoom.controller.sign?.username === Game.user.name) {
  //       return  // finished
  //     }

  //     // TODO: launch scout
  //     return
  //   }
  //   // TODO: launch observation
  //   return
  // }
}
