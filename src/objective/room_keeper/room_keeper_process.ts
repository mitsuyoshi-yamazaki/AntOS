import { Procedural } from "objective/procedural"
import { Process, ProcessId, processLog, ProcessState } from "objective/process"
import { RoomName } from "prototype/room"
import { roomLink } from "utility/log"

export interface RoomKeeperProcessState extends ProcessState {
  /** room name */
  r: RoomName,
}

export class RoomKeeperProcess implements Process, Procedural {
  public constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly roomName: RoomName,
  ) { }

  public encode(): RoomKeeperProcessState {
    return {
      t: "RoomKeeperProcess",
      l: this.launchTime,
      i: this.processId,
      r: this.roomName,
    }
  }

  public static decode(state: RoomKeeperProcessState): RoomKeeperProcess {
    return new RoomKeeperProcess(state.l, state.i, state.r)
  }

  public runOnTick(): void {
    const room = Game.rooms[this.roomName]
    if (room == null) {
      processLog(this, `${roomLink(this.roomName)} is not visible`)
      return
    }
    const sources = room.find(FIND_SOURCES)
    const spawns: StructureSpawn[] = []
    const extensions: StructureExtension[] = []
    const towers: StructureTower[] = []

    const myStructures = room.find(FIND_MY_STRUCTURES)
    myStructures.forEach(structure => {
      switch (structure.structureType) {
      case STRUCTURE_SPAWN:
        spawns.push(structure)
        break
      case STRUCTURE_EXTENSION:
        extensions.push(structure)
        break
      case STRUCTURE_TOWER:
        towers.push(structure)
        break
      default:
        break // TODO: 全て網羅する
      }
    })
  }

}

type ClaimedRoomState = RoomStateRCL1 | RoomStateRCL2 | RoomStateRCL3 | RoomStateRCL4

interface RoomState {
  roomControllerLevel: number
}

interface RoomStateRCL1 extends RoomState {
  spawns: StructureSpawn[]
}

interface RoomStateRCL2 extends RoomStateRCL1 {
  extensions: StructureExtension[]
}

interface RoomStateRCL3 extends RoomStateRCL2 {
  towers: StructureTower[]
}

interface RoomStateRCL4 extends RoomStateRCL3 {
  storage: StructureStorage | null
}
