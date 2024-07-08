import { Position } from "shared/utility/position_v2"


type SupportedStructureTypes = STRUCTURE_TOWER
  | STRUCTURE_SPAWN
  | STRUCTURE_TERMINAL
  | STRUCTURE_STORAGE
  | STRUCTURE_CONTAINER


export type EnergyHarvestRoomLayoutState = {
  readonly w: Position
  readonly d: Position
  readonly l: string
}

export class EnergyHarvestRoomLayout {
  private constructor(
    public readonly workerPosition: Position,
    public readonly distributorPosition: Position,
    private readonly layoutState: string,
  ) { }

  public encode(): EnergyHarvestRoomLayoutState {
    return {
      w: this.workerPosition,
      d: this.distributorPosition,
      l: this.layoutState,
    }
  }

  public static decode(state: EnergyHarvestRoomLayoutState): EnergyHarvestRoomLayout {
    return new EnergyHarvestRoomLayout(state.w, state.d, state.l)
  }

  /** @throws */
  public static create(controller: StructureController): EnergyHarvestRoomLayout {
    if (controller.room.name !== "E31N57") { // TODO:
      throw "Not implemented yet"
    }
    return new EnergyHarvestRoomLayout({ x: 40, y: 25 }, { x: 41, y: 23 }, "tttt-tpsr")
  }
}


// class StructureLayout {
//   public readonly structureTypes: Map<SupportedStructureTypes, Position[]>
//   public readonly rampartPositions: Position[]
//   public readonly structureByDirectionFromCenter: Map<DirectionConstant, SupportedStructureTypes>

//   /** @throws */
//   public constructor(layoutState: string) {
//     const structures = parseLayoutState(layoutState)

//   }
// }

// /** @throws */
// const parseLayoutState = (state: string): SupportedStructureTypes[][] {

// }
