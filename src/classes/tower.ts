
export interface RunTowersOpts {
  wall_max_hits?: number
  excluded_wall_ids?: string[]
  repairing_wall_id?: string
}

export function runTowers(towers: StructureTower[], room: Room, opts?: RunTowersOpts): string | null { // Returns repairing wall id
  opts = opts || {}
  const wall_max_hits = opts.wall_max_hits || 20000000  // 20M

  const damaged_hostiles: Creep[] = room.attacker_info.hostile_creeps.filter((creep) => {
    return (creep.hits < creep.hitsMax)
  })

  const damaged_healers: Creep[] = damaged_hostiles.filter((creep) => {
    return creep.hasActiveBodyPart(HEAL)
  })

  const damaged_my_creeps: Creep[] = room.find(FIND_MY_CREEPS, {
    filter: (creep) => {
      return (creep.hits < creep.hitsMax)
    }
  })

  const hits_max = 114000
  const has_much_energy = !(!room.storage) && (room.storage.store.energy > 500000)

  const excluded_walls = !opts.excluded_wall_ids ? [] : opts.excluded_wall_ids
  const repairing_wall = !opts.repairing_wall_id ? undefined : Game.getObjectById(opts.repairing_wall_id) as StructureWall | StructureRampart | undefined

  const damaged_structures: AnyStructure[] = room.find(FIND_STRUCTURES, { // To Detect non-ownable structures
    filter: (structure) => {
      if (excluded_walls.indexOf(structure.id) >= 0) {
        return false
      }

      const is_wall = (structure.structureType == STRUCTURE_WALL) || (structure.structureType == STRUCTURE_RAMPART)
      if (is_wall && has_much_energy) {
        return false
      }
      const max = is_wall ? hits_max : (structure.hitsMax * 0.7)
      return (structure.hits < Math.min(structure.hitsMax, max))
    }
  }).sort((lhs, rhs) => {
    if (lhs.hits > rhs.hits) return 1
    return -1
  })

  let damaged_wall: StructureWall | StructureRampart | undefined

  if (repairing_wall) {
    damaged_wall = repairing_wall
  }
  else if (has_much_energy) {
    const walls: (StructureWall | StructureRampart)[] = (room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        if (excluded_walls.indexOf(structure.id) >= 0) {
          return false
        }

        if (structure.hits == structure.hitsMax) {
          return false
        }
        const is_wall = (structure.structureType == STRUCTURE_WALL) || (structure.structureType == STRUCTURE_RAMPART)
        return is_wall
      }
    }) as (StructureWall | StructureRampart)[]).sort((lhs, rhs) => {
      if (lhs.hits > rhs.hits) return 1
      return -1
    })

    if (walls[0].hits < wall_max_hits) {
      damaged_wall = walls[0]
    }
  }

  const should_attack_hostile = room.attacked && ((room.attacker_info.heal <= 25) || (room.attacker_info.hostile_teams.indexOf('Invader') >= 0) || (room.attacker_info.hostile_creeps.length < 3))

  towers.forEach((tower) => {

    if (should_attack_hostile) {
      if(damaged_healers.length > 0) {
        const hostile = tower.pos.findClosestByRange(damaged_healers)
        if (hostile) {
          tower.attack(hostile)
          return
        }
        else {
          console.log(`Region ${room.name} unexpected error: damaged healer not found ${damaged_healers}.`)
        }
      }
      else if (damaged_hostiles.length > 0) {
        const hostile = tower.pos.findClosestByRange(damaged_hostiles)
        if (hostile) {
          tower.attack(hostile)
          return
        }
        else {
          console.log(`Region ${room.name} unexpected error: damaged hostile not found ${damaged_hostiles}.`)
        }
      }
      else {
        const hostile = tower.pos.findClosestByRange(room.attacker_info.hostile_creeps)
        if (hostile) {
          tower.attack(hostile)
          return
        }
        else {
          console.log(`Region ${room.name} unexpected error: hostile not found ${room.attacked}, ${room.attacker_info.hostile_creeps}.`)
        }
      }
    }

    if (damaged_my_creeps.length > 0) {
      const damaged_creep = tower.pos.findClosestByRange(damaged_my_creeps)
      if (damaged_creep) {
        tower.heal(damaged_creep)
        return
      }
      else {
        console.log(`Region ${room.name} unexpected error: damaged_creep not found ${damaged_my_creeps}.`)
      }
    }

    if ((tower.energy > (tower.energyCapacity * 0.66))) {
      const structure = damaged_structures[0]
      if (structure) {
        tower.repair(structure)
        return
      }
      if (damaged_wall) {
        tower.repair(damaged_wall)
        return
      }
    }
  })

  if (damaged_wall) {
    return damaged_wall.id
  }
  return null
}
