import { SectorName } from "shared/utility/room_sector_type"

export class Region {
  public constructor(
    sectors: SectorName[],
  ) {

  }

  public currentState(): string {
    // taking the sector => waiting RCL8
    // attacking Quorum => waiting RCL6
    // attacking => waiting CPU optimization & continuous attack
    // nuke
  }
}
