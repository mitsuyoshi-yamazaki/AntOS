// Requestはインターフェースのみ用意して中身は仮組みしておく
// -> Request roomのみ指定して内部的にはparent roomを算出して使う

import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Stateful } from "os/infrastructure/state"
import { Timestamp } from "utility/timestamp"
import { DeclarationFinishCondition, DeclarationState } from "./declaration_state"

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

type DeclarationIdentifier = string

export interface Declaration extends Stateful {
  readonly identifier: DeclarationIdentifier
  readonly launchTime: Timestamp
  readonly finishCondition: DeclarationFinishCondition
  readonly progress: DeclarationProgress

  runOnTick(): void
}
