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
  public readonly room: Room

  private constructor(
    public readonly controller: StructureController,
    public readonly workerPosition: Position,
    public readonly distributorPosition: Position,
  ) {
    this.room = controller.room
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
}
