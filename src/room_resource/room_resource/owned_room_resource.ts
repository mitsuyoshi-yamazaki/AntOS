import { EnergyChargeableStructure } from "prototype/room_object"
import { RoomInfo } from "world_info/room_info"
import { NormalRoomResource } from "./normal_room_resource"

この部屋に紐づくCreepの情報を含める
export class OwnedRoomResource extends NormalRoomResource {
  /** Decayed structureは含めない */
  public readonly damagedStructures: AnyStructure[]
  public readonly activeStructures: {
    spawns: StructureSpawn[]
    extensions: StructureExtension[]
    towers: StructureTower[]
    storage: StructureStorage | null
    terminal: StructureTerminal | null

    chargeableStructures: EnergyChargeableStructure[]
  }

  public readonly walls: StructureWall[]
  public readonly ramparts: StructureRampart[]

  public constructor(
    public readonly controller: StructureController,
    roomInfo: RoomInfo,
  ) {
    super(controller, roomInfo)

    this.damagedStructures = []

    const spawns: StructureSpawn[] = []
    const extensions: StructureExtension[] = []
    const towers: StructureTower[] = []
    let storage: StructureStorage | null = null
    let terminal: StructureTerminal | null = null
    const chargeableStructures: EnergyChargeableStructure[] = []

    this.walls = []
    this.ramparts = []

    const excludedDamagedStructureTypes: StructureConstant[] = [
      STRUCTURE_WALL,
      STRUCTURE_RAMPART,
      STRUCTURE_ROAD,
      STRUCTURE_CONTAINER,
    ]
    this.room.find(FIND_STRUCTURES).forEach(structure => {
      if (structure.isActive() !== true) {
        return
      }
      if (excludedDamagedStructureTypes.includes(structure.structureType) !== true && structure.hits < structure.hitsMax) {
        this.damagedStructures.push(structure)
      }

      switch (structure.structureType) {
      case STRUCTURE_SPAWN:
        spawns.push(structure)
        if (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          chargeableStructures.push(structure)
        }
        break
      case STRUCTURE_EXTENSION:
        extensions.push(structure)
        if (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          chargeableStructures.push(structure)
        }
        break
      case STRUCTURE_TOWER:
        towers.push(structure)
        if (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          chargeableStructures.push(structure)
        }
        break
      case STRUCTURE_STORAGE:
        storage = structure
        if (structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
          this.energyStores.push(structure)
        }
        break
      case STRUCTURE_TERMINAL:
        terminal = structure
        if (structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
          this.energyStores.push(structure)
        }
        break
      case STRUCTURE_WALL:
        this.walls.push(structure)
        break
      case STRUCTURE_RAMPART:
        this.ramparts.push(structure)
        break
      default:
        break // TODO: 全て網羅する
      }
    })

    this.activeStructures = {
      spawns,
      extensions,
      towers,
      storage,
      terminal,
      chargeableStructures,
    }
  }
}
