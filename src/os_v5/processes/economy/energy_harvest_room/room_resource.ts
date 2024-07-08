import { Position } from "shared/utility/position_v2"

/**
# EnergyHarvestRoomResource
## 概要

## レイアウト

 */

export type EnergyHarvestRoomResourceState = {
  readonly w: Position
  readonly d: Position
}

export class EnergyHarvestRoomResource {
  public get controller(): StructureController {
    return this._controller
  }
  private _controller: StructureController

  private constructor(
    controller: StructureController,
    public readonly workerPosition: Position,
    public readonly distributorPosition: Position,
  ) {
    this._controller = controller
  }

  public encode(): EnergyHarvestRoomResourceState {
    return {
      w: this.workerPosition,
      d: this.distributorPosition,
    }
  }

  public static decode(state: EnergyHarvestRoomResourceState, controller: StructureController): EnergyHarvestRoomResource {
    return new EnergyHarvestRoomResource(controller, state.w, state.d)
  }

  public static create(controller: StructureController, workerPosition: Position, distributorPosition: Position): EnergyHarvestRoomResource {
    return new EnergyHarvestRoomResource(controller, workerPosition, distributorPosition)
  }

  public reload(controller: StructureController): void {
    this._controller = controller
  }
}
