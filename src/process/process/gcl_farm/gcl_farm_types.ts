import { Position } from "prototype/room_position"
import { RoomName } from "utility/room_name"

export type GclFarmRoom = {
  readonly roomName: RoomName
  readonly parentRoomNames: RoomName[]
}

export type GclFarmPlan = {
  storagePosition: Position,
  terminalPosition: Position,
  spawnPosition: Position,
  distributorPosition: Position,
  tower1Position: Position,
  tower2Position: Position,
  tower3Position: Position,
  upgraderPositions: Position[],
}
