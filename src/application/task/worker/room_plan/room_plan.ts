import { RoomName } from "utility/room_name"

type Position = {
  x: number
  y: number
}

export type RemoteHarvestRoomPlan = {
  parentRoomName: RoomName
}

export type OwnedRoomPlan = {
  structures: { [structureType in BuildableStructureConstant]: Position[] }
}

function createRoomPlanFromCurrenstState(room: Room): OwnedRoomPlan {
  return {
    structures: {
      extension: [],
      rampart: [],
      road: [],
      spawn: [],
      link: [],
      constructedWall: [],
      storage: [],
      tower: [],
      observer: [],
      powerSpawn: [],
      extractor: [],
      lab: [],
      terminal: [],
      container: [],
      nuker: [],
      factory: [],
    }
  }
}
