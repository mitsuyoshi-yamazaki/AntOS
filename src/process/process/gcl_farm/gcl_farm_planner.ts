import { Position } from "prototype/room_position"
import { GameConstants } from "utility/constants"
import { roomLink } from "utility/log"
import { RoomName } from "utility/room_name"
import { calculateAbsoluteGclFarmPositions, GclFarmPositions, getGclFarmPredefinedPlan } from "./gcl_farm_predefined_plans"

export class GclFarmRoomPlan {
  // public readonly storagePosition: RoomPosition
  // public readonly terminalPosition: RoomPosition
  // public readonly spawnPosition: RoomPosition
  // public readonly distributorPosition: RoomPosition
  // public readonly tower1Position: RoomPosition
  // public readonly tower2Position: RoomPosition
  // // public readonly tower3Position: RoomPosition
  // public readonly upgraderPositions: RoomPosition[]

  public constructor(
    private readonly roomName: RoomName,
    readonly positions: GclFarmPositions,
  ) {
    // this.storagePosition = decodeRoomPosition(positions.storagePosition, roomName)
    // this.terminalPosition = decodeRoomPosition(positions.terminalPosition, roomName)
    // this.spawnPosition = decodeRoomPosition(positions.spawnPosition, roomName)
    // this.distributorPosition = decodeRoomPosition(positions.distributorPosition, roomName)
    // this.tower1Position = decodeRoomPosition(positions.tower1Position, roomName)
    // this.tower2Position = decodeRoomPosition(positions.tower2Position, roomName)
    // // this.tower3Position = decodeRoomPosition(positions.tower3Position, roomName)
    // this.upgraderPositions = positions.upgraderPositions.map(position => decodeRoomPosition(position, roomName))
  }

  // public encode(): GclFarmRoomPlanState {
  //   return {
  //     "t": "GclFarmRoomPlan",
  //     roomName: this.roomName,
  //     positions: this.positions,
  //   }
  // }

  // public static decode(state: GclFarmRoomPlanState): GclFarmRoomPlan {
  //   return new GclFarmRoomPlan(state.roomName, state.positions)
  // }

  /** throws */
  public static createRoomPlan(controller: StructureController, planName: string, storagePosition: Position): GclFarmRoomPlan {
    const predefinedPositions = getGclFarmPredefinedPlan(planName)
    if (predefinedPositions == null) {
      throw `no predefined plan for ${planName}`
    }

    const absolutePositions = calculateAbsoluteGclFarmPositions(predefinedPositions, storagePosition)
    const allPositions: Position[] = [
      absolutePositions.storagePosition,
      absolutePositions.terminalPosition,
      absolutePositions.spawnPosition,
      absolutePositions.distributorPosition,
      absolutePositions.tower1Position,
      absolutePositions.tower2Position,
      ...absolutePositions.upgraderPositions,
    ]

    const targetRoom = controller.room
    allPositions.forEach(position => {
      const lookResult = targetRoom.lookForAt(LOOK_TERRAIN, position.x, position.y)
      const isWall = lookResult.some(terrain => terrain === "wall")
      if (isWall === true) {
        throw `${position.x},${position.y} is wall in ${roomLink(targetRoom.name)}`
      }
    })

    absolutePositions.upgraderPositions.forEach(position => {
      if (controller.pos.getRangeTo(position.x, position.y) > GameConstants.creep.actionRange.upgradeController) {
        throw `upgrader position ${position.x},${position.y} is too far`
      }
    })

    return new GclFarmRoomPlan(targetRoom.name, absolutePositions)
  }

  public showVisible(): void {
    const room = Game.rooms[this.roomName]
    if (room == null) {
      return
    }

    const show = (position: Position, text: string): void => {
      room.visual.text(text, position.x, position.y, {color: "#FF0000"})
    }

    show(this.positions.storagePosition, "s")
    show(this.positions.terminalPosition, "t")
    show(this.positions.spawnPosition, "p")
    show(this.positions.distributorPosition, "d")
    show(this.positions.tower1Position, "o")
    show(this.positions.tower2Position, "o")
    this.positions.upgraderPositions.forEach(position => show(position, "u"))
  }
}
