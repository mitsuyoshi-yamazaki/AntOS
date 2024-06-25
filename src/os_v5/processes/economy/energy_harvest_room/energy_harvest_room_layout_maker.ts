import { EnergyHarvestRoomResource } from "./energy_harvest_room_resource"

export class EnergyHarvestRoomLayoutMaker {
  public constructor(
    public readonly controller: StructureController,
  ) { }

  /** @throws */
  public makeLayout(): EnergyHarvestRoomResource {
    if (this.controller.room.name !== "E31N57") { // TODO:
      throw "Not implemented yet"
    }
    return EnergyHarvestRoomResource.create(this.controller, { x: 40, y: 25 }, { x: 41, y: 23 })
  }
}
