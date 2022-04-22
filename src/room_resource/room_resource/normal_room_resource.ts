import { EnergySource, EnergyStore, parseIds } from "prototype/room_object"
import { RoomInfoType } from "room_resource/room_info"
import { RoomResource } from "room_resource/room_resource"

export class NormalRoomResource implements RoomResource {
  public readonly roomType = "normal"

  public readonly room: Room
  public readonly sources: Source[]
  public readonly mineral: Mineral | null
  public readonly constructionSites: ConstructionSite<BuildableStructureConstant>[]

  public readonly energySources: EnergySource[]
  public readonly energyStores: EnergyStore[] // TODO: Creepも含める

  public readonly decayedStructures: AnyStructure[]

  public readonly droppedResources: Resource[]
  public readonly tombStones: Tombstone[]
  public readonly flags: Flag[]

  public readonly myCreeps: {
    damagedCreeps: Creep[]
  }
  public readonly hostiles: {
    creeps: Creep[]
    powerCreeps: PowerCreep[]
  }
  public readonly alliances: {
    creeps: Creep[]
    powerCreeps: PowerCreep[]
  }

  public constructor(
    public readonly controller: StructureController,
    public readonly roomInfo: RoomInfoType | null,
  ) {
    this.room = this.controller.room

    // ---- Resources ---- //
    this.sources = this.room.find(FIND_SOURCES)
    this.mineral = this.room.find(FIND_MINERALS)[0] ?? null

    // Construction Sites ---- //
    this.constructionSites = this.room.find(FIND_MY_CONSTRUCTION_SITES)

    // ---- Structures ---- //
    this.droppedResources = this.room.find(FIND_DROPPED_RESOURCES)
    this.tombStones = this.room.find(FIND_TOMBSTONES)

    this.energySources = this.tombStones.filter(tombStone => tombStone.store.getUsedCapacity(RESOURCE_ENERGY) > 50)
    this.energySources.push(...this.droppedResources.filter(resource => resource.resourceType === RESOURCE_ENERGY))
    this.energyStores = []

    if (roomInfo != null) {
      const energySourceStructures = parseIds(roomInfo.energySourceStructureIds)
      const energyStoreStructures = parseIds(roomInfo.energyStoreStructureIds)
      this.energySources.push(...energySourceStructures)
      this.energyStores.push(...energyStoreStructures)
    }

    this.decayedStructures = []
    const checkDecayed = ((structure: AnyStructure): void => {
      if (structure.hits < structure.hitsMax * 0.6) {
        this.decayedStructures.push(structure)
      }
    })

    this.room.find(FIND_STRUCTURES).forEach(structure => {
      switch (structure.structureType) {
      case STRUCTURE_ROAD:
      case STRUCTURE_CONTAINER:
        checkDecayed(structure)
        break

      default:
        break
      }
    })

    // ---- Creeps ---- //
    const myCreeps = this.room.find(FIND_MY_CREEPS)
    this.myCreeps = {
      damagedCreeps: myCreeps.filter(creep => creep.hits < creep.hitsMax)
    }

    const othersCreeps = this.room.find(FIND_HOSTILE_CREEPS)
    const othersPowerCreeps = this.room.find(FIND_HOSTILE_POWER_CREEPS)
    const hostileCreeps: Creep[] = []
    const hostilePowerCreeps: PowerCreep[] = []
    const allianceCreeps: Creep[] = []
    const alliancePowerCreeps: PowerCreep[] = []

    const localWhitelistedUsers = roomInfo?.localWhitelistedUsers ?? []
    const isEnemy = (owner: Owner): boolean => {
      if (Game.isEnemy(owner) !== true) {
        return false
      }
      if (localWhitelistedUsers.includes(owner.username) === true) {
        return false
      }
      return true
    }

    othersCreeps.forEach(creep => {
      if (isEnemy(creep.owner)) {
        hostileCreeps.push(creep)
      } else {
        allianceCreeps.push(creep)
      }
    })
    othersPowerCreeps.forEach(powerCreep => {
      if (isEnemy(powerCreep.owner)) {
        hostilePowerCreeps.push(powerCreep)
      } else {
        alliancePowerCreeps.push(powerCreep)
      }
    })

    this.hostiles = {
      creeps: hostileCreeps,
      powerCreeps: hostilePowerCreeps,
    }
    this.alliances = {
      creeps: allianceCreeps,
      powerCreeps: alliancePowerCreeps,
    }

    // ---- Flags ---- //
    this.flags = this.room.find(FIND_FLAGS)
  }
}
