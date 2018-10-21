import { UID, room_link } from "classes/utils"
import { Squad, SquadType, SquadMemory, SpawnPriority, SpawnFunction } from "./squad"
import { CreepStatus, ActionResult, CreepType } from "classes/creep"
import { Region } from "../region";

export interface HarvesterSquadMemory extends SquadMemory {
  readonly source_id: string
  readonly room_name: string
  link_id?: string
}

export class HarvesterSquad extends Squad {
  private resource_type: ResourceConstant | undefined
  private harvesters: Creep[]
  private carriers: Creep[]
  private source: Source | Mineral | undefined  // A source that the harvester harvests energy
  private store: StructureContainer | StructureLink | StructureStorage | undefined // A store that the harvester stores energy
  private container: StructureContainer | StructureLink | undefined // A energy container that the carrier withdraws energy
  private destination_storage: StructureStorage | undefined
  private mineral_harvester_energy_max = 2500

  private needs_harvester: boolean

  constructor(readonly name: string, readonly source_info: {id: string, room_name: string}, readonly destination: StructureContainer | StructureTerminal | StructureStorage | StructureLink | StructureSpawn, readonly energy_capacity: number, readonly region: Region) {
    super(name)

    this.destination_storage = this.destination as StructureStorage // @fixme:

    const is_alive = (this.energy_capacity > 300)

    if (!this.destination && is_alive && (this.owner_room_name != 'W53S15')) {
      if (((Game.time + 3) % 7) == 0) {
        console.log(`HarvesterSquad destination not specified ${this.name}`)
      }
    }

    this.harvesters = []
    this.carriers = []

    this.creeps.forEach((creep, _) => {
      switch (creep.memory.type) {
        case CreepType.HARVESTER:
          this.harvesters.push(creep)
          break

        case CreepType.CARRIER:
          this.carriers.push(creep)
          break

        default:
          console.log(`HarvesterSquad unexpected creep type ${creep.memory.type}, ${this.name}, ${creep.pos}`)
          break
      }
    })

    if (this.harvesters.length >= 2) {
      this.needs_harvester = false
    }
    else {
      const harvester = this.harvesters[0]

      if (!harvester) {
        this.needs_harvester = true
      }
      else if ((harvester.ticksToLive || 1500) < 50) {
        this.needs_harvester = true
      }
      else {
        this.needs_harvester = false
      }
    }

    this.get_sources()
  }

  private get_sources(): void {
    const source = Game.getObjectById(this.source_info.id) as Source | Mineral
    if (!source) {
      return
    }
    this.source = source

    if (this.source_info.id == '59f1c0ce7d0b3d79de5f0165') { // W51S29 lemergium
      this.resource_type = RESOURCE_LEMERGIUM
    }
    else if (this.source_info.id == '59f1c0cf7d0b3d79de5f037c') { // W44S7 Hydrogen
      this.resource_type = RESOURCE_HYDROGEN
    }
    else if (this.source_info.id == '59f1c0ce7d0b3d79de5f0228') { // W48S6 Hydrogen
      this.resource_type = RESOURCE_HYDROGEN
    }
    else if (this.source_info.id == '59f1c0cf7d0b3d79de5f03d7') { // W43S5 Utrium
      this.resource_type = RESOURCE_UTRIUM
    }
    else if (this.source_info.id == '59f1c0ce7d0b3d79de5f0294') { // W47S6 Lemergium
      this.resource_type = RESOURCE_LEMERGIUM
    }
    else if (this.source_info.id == '59f1c0ce7d0b3d79de5f0297') { // W47S9 Catalyst
      this.resource_type = RESOURCE_CATALYST
    }
    else if (this.source_info.id == '59f1c0cf7d0b3d79de5f0340') { // W45S27 Utrium
      this.resource_type = RESOURCE_UTRIUM
    }
    else if (this.source_info.id == '59f1c0cf7d0b3d79de5f02eb') { // W46S3 Oxygen
      this.resource_type = RESOURCE_OXYGEN
    }
    else if (this.source_info.id == '59f1c0de7d0b3d79de5f17a3') { // E16N37 Keanium
      this.resource_type = RESOURCE_KEANIUM
    }
    else if (this.source_info.id == '59f1c0cd7d0b3d79de5eff8c') { // W56S7
      this.resource_type = RESOURCE_CATALYST
    }
    else if (this.source_info.id == '59f1c0cd7d0b3d79de5effdf') { // W55S23
      this.resource_type = RESOURCE_HYDROGEN
    }
    else if (this.source_info.id == '59f1c0cd7d0b3d79de5effd9') { // W55S13
      this.resource_type = RESOURCE_OXYGEN
    }
    else if (this.source_info.id == '59f1c0cc7d0b3d79de5efec6') { // W58S4 Hydrogen
      this.resource_type = RESOURCE_HYDROGEN
    }
    else if (this.source_info.id == '59f1c0cd7d0b3d79de5f001c') { // W54S7 Hydrogen
      this.resource_type = RESOURCE_HYDROGEN
    }
    else if (this.source_info.id == '59f1c0cf7d0b3d79de5f0333') { // W45S3 Hydrogen
      this.resource_type = RESOURCE_HYDROGEN
    }
    else if (this.source_info.id == '59f1c0cd7d0b3d79de5f0080') { // W53S15 Oxygen
      this.resource_type = RESOURCE_OXYGEN
    }
    else if (this.source_info.id == '59f1c0cd7d0b3d79de5f0077') { // W53S5 Keanium
      this.resource_type = RESOURCE_KEANIUM
    }
    else if (this.source_info.id == '59f1c0cc7d0b3d79de5eff32') { // W57S4 Hydrogen
      this.resource_type = RESOURCE_HYDROGEN
    }
    else {
      this.resource_type = RESOURCE_ENERGY
    }


    const store = this.source.pos.findInRange(FIND_STRUCTURES, 2, {
      filter: function(structure: Structure) {
        return structure.structureType == STRUCTURE_CONTAINER
      }
    })[0] as StructureContainer

    if (store) {
      this.store = store
      this.container = store
    }

    if (this.source_info.id == '59f19ff082100e1594f35c89') {
      const link = Game.getObjectById('5b0a5aaf7533293c116780a4') as StructureLink | undefined
      if (link && (link.energy < link.energyCapacity)) {
        this.store = link
      }
    }
    else if ((this.source_info.id == '59f19fd382100e1594f35a4b')) { // @fixme: temp code
      const link = Game.getObjectById('5b25ad0900c9b15f092dfa9c') as StructureLink | undefined // Link in W51S29 left
      if (link) {
        this.store = link
      }
    }
    else if ((this.source_info.id == '59f19fd382100e1594f35a4c')) { // @fixme: temp code
      const link = Game.getObjectById('5b1f067fd3624f4f7b40c05d') as StructureLink | undefined // Link in W51S29 bottom
      if (link) {
        this.store = link
      }
    }
    else if (this.source_info.id == '59f1a03882100e1594f36569') { // W44S7
      const link = Game.getObjectById('5b2e84e6a426a6424452130c') as StructureLink | undefined
      if (link && (link.energy < link.energyCapacity)) {
        this.store = link
      }
    }
    else if (this.source_info.id == '59f1a04682100e1594f36736') { // W43S5
      const link = Game.getObjectById('5b318a5682c736408cf8a54e') as StructureLink | undefined
      if (link && (link.energy < link.energyCapacity)) {
        this.store = link
      }
    }
    else if (this.source_info.id == '59f19ffa82100e1594f35d81') { // W48S6 top
      const link = Game.getObjectById('5b34eee144286f7b91f90f2e') as StructureLink | undefined
      if (link) {
        this.store = link
      }
    }
    else if (this.source_info.id == '59f19ffa82100e1594f35d82') { // W48S6 bottom
      const link = Game.getObjectById('5b34f78197be977d39dbf57e') as StructureLink | undefined
      if (link) {
        this.store = link
      }
    }
    else if (this.source_info.id == '59f1a00882100e1594f35eec') { // W48S6 bottom
      const link = Game.getObjectById('5b37bbbd6980fd26fd163797') as StructureLink | undefined
      if (link) {
        this.store = link
      }
    }
    else if (this.source_info.id == '59f1a03882100e1594f3656b') { // W44S7 bottom
      const link = Game.getObjectById('5b4886e633652d6850c4b543') as StructureLink | undefined
      if (link) {
        this.store = link
      }
    }
    else if (this.source_info.id == '59f1a00982100e1594f35f04') { // W47S6 left
      const link = Game.getObjectById('5b54101f184d6318688b74cf') as StructureLink | undefined
      if (link) {
        this.store = link
      }
    }
    else if (this.source_info.id == '59f1a00982100e1594f35f03') { // W47S6 right
      const link = Game.getObjectById('5b568b1c22e1946e01461f2b') as StructureLink | undefined
      if (link) {
        this.store = link
      }
    }
    else if (this.source_info.id == '59f1a00982100e1594f35f0e') { // W47S9 left
      const link = Game.getObjectById('5b5914d72d47046dfb432f50') as StructureLink | undefined
      if (link) {
        this.store = link
      }
    }
    else if (this.source_info.id == '59f1a01982100e1594f360dc') { // W46S3 right
      const link = Game.getObjectById('5b5a6dc7bb69253f6b6390f3') as StructureLink | undefined
      if (link) {
        this.store = link
      }
    }


    // --
    if ((this.source_info.id == '59f19fff82100e1594f35e06') && (this.carriers.length > 0)) {  // W48S47 top right
      const oxygen_container = Game.getObjectById('5af19724b0db053c306cbd30') as StructureContainer
      if (oxygen_container && (this.carriers.length > 0) && (this.carriers[0].carry.energy == 0) && ((oxygen_container.store[RESOURCE_OXYGEN] || 0) > 400)) {
        this.resource_type = RESOURCE_OXYGEN
        this.container = oxygen_container
      }
      else {
        const target = this.carriers[0].pos.findClosestByPath(FIND_STRUCTURES, { // Harvest from harvester containers and link
          filter: (structure) => {
            return ((structure.structureType == STRUCTURE_CONTAINER) && ((structure as StructureContainer).store.energy > 300))
              || ((structure.id == '5aee959afd02f942b0a03361') && ((structure as StructureLink).energy > 0)) // Link
          }
        }) as StructureContainer | StructureLink

        if (target) {
          this.container = target
        }
      }
      if (!oxygen_container) {
        const message = `HarvesterSquad oxygen_container in ${this.source_info.room_name} not found`
        console.log(message)
        Game.notify(message)
      }
    }
    else if ((this.source_info.id == '59f19ff082100e1594f35c84') && (this.carriers.length > 0)) { // W49S47 top right
      const utrium_container = Game.getObjectById('5b26ef4ad307cc2f4ed53532') as StructureContainer
      if (utrium_container && (this.carriers.length > 0) && (this.carriers[0].carry.energy == 0) && ((utrium_container.store[RESOURCE_UTRIUM] || 0) > 400)) {
        this.resource_type = RESOURCE_UTRIUM
        this.container = utrium_container
      }
      else {
        const target = this.carriers[0].pos.findClosestByPath(FIND_STRUCTURES, { // Harvest from harvester containers and link
          filter: (structure) => {
            return ((structure.structureType == STRUCTURE_CONTAINER) && ((structure as StructureContainer).store.energy > 600))
              || ((structure.id == '5af1900395fe4569eddba9da') && ((structure as StructureLink).energy > 0)) // link
          }
        }) as StructureContainer | StructureLink

        if (target) {
          this.container = target
        }
      }

      if (!utrium_container) {
        const message = `HarvesterSquad utrium_container in ${this.source_info.room_name} not found`
        console.log(message)
        Game.notify(message)
      }
    }
    else if ((this.source_info.id == '59f19fff82100e1594f35dec') && (this.carriers.length > 0)) {  // W48S39 left
      const target = this.carriers[0].pos.findClosestByPath(FIND_STRUCTURES, { // Harvest from harvester containers and link
        filter: (structure) => {
          return ((structure.structureType == STRUCTURE_CONTAINER) && ((structure as StructureContainer).store.energy > 300))
        }
      }) as StructureContainer | StructureLink

      if (target) {
        this.container = target
      }
    }
    else if ((this.source_info.id == '59f1a01e82100e1594f36174') && (this.carriers.length > 0)) {  // W46S33 bottom left
      const target = this.carriers[0].pos.findClosestByPath(FIND_STRUCTURES, {
        filter: (structure) => {
          if (structure.structureType != STRUCTURE_CONTAINER) {
            return false
          }
          if (structure.id == '59f1a01e82100e1594f36173') { // center
            return ((structure as StructureContainer).store.energy > 1000)
          }
          return ((structure as StructureContainer).store.energy > 300)
        }
      }) as StructureContainer | StructureLink

      if (target) {
        this.container = target
      }
    }

    const squad_memory = Memory.squads[this.name] as HarvesterSquadMemory

    if (squad_memory && squad_memory.link_id) {
      const link = Game.getObjectById(squad_memory.link_id) as StructureLink | undefined
      if (link) {
        this.store = link
      }
    }

    if (((Game.time % 991) == 1) && (this.resource_type == RESOURCE_ENERGY) && this.store && (this.store.structureType == STRUCTURE_CONTAINER) && squad_memory && !squad_memory.link_id) {
      const link = this.store.pos.findInRange(FIND_MY_STRUCTURES, 1, {
        filter: (structure: Structure) => {
          return structure.structureType == STRUCTURE_LINK
        }
      })[0]

      if (link) {
        if (this.source_info.room_name != 'W49S6') {
          (Memory.squads[this.name] as HarvesterSquadMemory).link_id = link.id
        }
      }
    }
  }

  public get type(): SquadType {
    return SquadType.HARVESTER
  }

  public static generateNewName(): string {
    return UID(SquadType.HARVESTER)
  }

  public generateNewName(): string {
    return HarvesterSquad.generateNewName()
  }

  // --
  public get spawnPriority(): SpawnPriority {
    const squad_memory = Memory.squads[this.name]
    if (squad_memory.stop_spawming) {
      return SpawnPriority.NONE
    }

    const room = Game.rooms[this.source_info.room_name]

    if (this.energy_capacity < 550) {
      return SpawnPriority.NONE
    }

    if (this.needs_harvester) {
      if (room && room.attacker_info().heavyly_attacked && (this.resource_type != RESOURCE_ENERGY)) {
        this.creeps.forEach((creep) => {
          creep.memory.let_thy_die = true
        })
        return SpawnPriority.NONE
      }

      const source = Game.getObjectById(this.source_info.id) as Source | Mineral
      // Using (source as Mineral).mineralType because (source as Mineral).mineralAmount when it's 0 value, it's considered as false
      if (room && (source as Mineral).mineralType && ((source as Mineral).mineralAmount == 0) && ((source.ticksToRegeneration || 0) > 100)) {
        if ((Game.time % 23) == 5) {
          this.creeps.forEach((creep) => {
            creep.memory.let_thy_die = true
          })
        }
        return SpawnPriority.NONE
      }
      return SpawnPriority.HIGH
    }

    let number_of_carriers = 1

    if (this.destination && (this.destination.room.name != this.source_info.room_name)) {
      number_of_carriers = 2
    }

    if (this.store && (this.store.structureType == STRUCTURE_LINK)) {
      number_of_carriers = 0
    }

    if ((this.store) && (this.carriers.length < number_of_carriers)) {
      return SpawnPriority.NORMAL
    }
    return SpawnPriority.NONE
  }

  public hasEnoughEnergy(energyAvailable: number, capacity: number): boolean {
    if (this.needs_harvester) {
      if (this.resource_type && (this.resource_type != RESOURCE_ENERGY)) {
        const room = Game.rooms[this.source_info.room_name]
        if (room && room.controller && room.controller.my) {
          switch (room.controller.level) {
            case 8:
              this.mineral_harvester_energy_max = 3300  // @fixme: 4300 causes bug
              break

            case 7:
              this.mineral_harvester_energy_max = 3300
              break
          }
        }

        capacity = Math.min(capacity, this.mineral_harvester_energy_max)

        const energy_unit = 250
        const energyNeeded = (Math.floor((capacity - 150) / energy_unit) * energy_unit)
        return energyAvailable >= energyNeeded
      }

      // harvester
      const energy_unit = 300
      const energy_needed = Math.min((Math.floor(capacity / energy_unit) * energy_unit), 850)
      return energyAvailable >= energy_needed
    }
    else {
      const energy_unit = 100
      const energy_needed = Math.min((Math.floor(capacity / energy_unit) * energy_unit), 1200)

      return energyAvailable >= energy_needed
    }
  }

  // --
  public addCreep(energyAvailable: number, spawnFunc: SpawnFunction): void {
    if (this.needs_harvester) {
      if (this.resource_type && (this.resource_type != RESOURCE_ENERGY)) {
        this.addMineralHarvester(energyAvailable, spawnFunc)
      }
      else {
        this.addHarvester(energyAvailable, spawnFunc)
      }
    }
    else {
      this.addCarrier(energyAvailable, spawnFunc)
    }
  }

  public run(): void {
    this.runHarvesters()
    this.runCarriers()
  }

  public description(): string {
    return `${super.description()}, ${this.source_info.room_name}`
  }

  // Private
  private addHarvester(energyAvailable: number, spawnFunc: SpawnFunction): void {
    const room = Game.rooms[this.source_info.room_name]
    const minimum_body = !(!room) && !(!room.controller) && !(!room.controller.my) && (room.controller.level > 3)

    const body_unit: BodyPartConstant[] = [WORK, WORK, CARRY, MOVE]
    const energy_unit = 300

    const name = this.generateNewName()
    let body: BodyPartConstant[] = body_unit
    const memory: CreepMemory = {
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.HARVESTER,
      should_notify_attack: false,
      let_thy_die: true,
    }

    if (minimum_body && (energyAvailable >= 850)) {
      body = [
        WORK, WORK, WORK,
        WORK, WORK, WORK,
        CARRY, CARRY,
        MOVE, MOVE, MOVE,
      ]
    }
    else {
      if (energyAvailable >= (energy_unit * 2)) {  // (energy_unit * 2) is the maximum
        body = body.concat(body_unit)
        // console.log(`FUGA ${energyAvailable} ${this.owner_room_name}`)
      }
      // console.log(`HOGE ${energyAvailable} ${this.owner_room_name}`)
    }
    // console.log(`PAKE ${energyAvailable} ${this.owner_room_name}`)

    const result = spawnFunc(body, name, {
      memory: memory
    })
  }

  private addCarrier(energyAvailable: number, spawnFunc: SpawnFunction): void {
    const room = Game.rooms[this.source_info.room_name]
    const minimum_body = !(!room) && !(!room.controller) && !(!room.controller.my) && (room.controller.level > 3)

    const body_unit: BodyPartConstant[] = minimum_body ? [CARRY, CARRY, MOVE] : [CARRY, MOVE]
    const energy_unit = minimum_body ? 150 : 100
    let let_thy_die = (energyAvailable >= 1200) ? false : true

    const name = this.generateNewName()
    let body: BodyPartConstant[] = []
    const memory: CreepMemory = {
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.CARRIER,
      should_notify_attack: false,
      let_thy_die: let_thy_die,
    }

    let max_energy = minimum_body ? 900 : 1200

    if (this.source_info.id == '59f1a03882100e1594f3656b') { // W44S7 bottom
      max_energy = 900
    }

    energyAvailable = Math.min(energyAvailable, max_energy)

    while (energyAvailable >= energy_unit) {
      body = body.concat(body_unit)
      energyAvailable -= energy_unit
    }

    const result = spawnFunc(body, name, {
      memory: memory
    })
  }

  private addMineralHarvester(energyAvailable: number, spawnFunc: SpawnFunction): void {


    this.addUpgrader(energyAvailable, spawnFunc, CreepType.HARVESTER, {max_energy: this.mineral_harvester_energy_max})
    // // capacity: 2300
    // // 8 units, 2C, 16W, 9M

    // energyAvailable = Math.min(energyAvailable, 2300)

    // const move: BodyPartConstant[] = [MOVE]
    // const work: BodyPartConstant[] = [WORK, WORK]
    // const energy_unit = 250

    // energyAvailable -= 150
    // const header: BodyPartConstant[] = [CARRY, CARRY]
    // let body: BodyPartConstant[] = [MOVE]
    // const name = this.generateNewName()
    // const memory: CreepMemory = {
    //   squad_name: this.name,
    //   status: CreepStatus.NONE,
    //   birth_time: Game.time,
    //   type: CreepType.HARVESTER,
    //   should_notify_attack: false,
    //   let_thy_die: true,
    // }

    // while (energyAvailable >= energy_unit) {
    //   body = move.concat(body)
    //   body = body.concat(work)
    //   energyAvailable -= energy_unit
    // }
    // body = header.concat(body)

    // const result = spawnFunc(body, name, {
    //   memory: memory
    // })
  }

  private runHarvesters(): void {
    this.harvesters.forEach((creep) => {


      runHarvester(creep, this.source_info.room_name, this.source, this.store, this.container, {
        resource_type: this.resource_type
      })
    })
  }


  private runCarriers(): void {
    this.carriers.forEach((creep) => {
      if (creep.spawning) {
        return
      }

      if (this.store && (this.store.structureType == STRUCTURE_LINK)) {
        creep.memory.let_thy_die = true
      }

      if ((creep.memory.status == CreepStatus.WAITING_FOR_RENEW) && ((creep.ticksToLive || 0) > 1400)) {
        creep.memory.status = CreepStatus.HARVEST
      }

      const needs_renew = !creep.memory.let_thy_die && ((creep.memory.status == CreepStatus.WAITING_FOR_RENEW) || ((creep.ticksToLive || 0) < 300))

      if (needs_renew) {
        if ((creep.room.spawns.length > 0) && ((creep.room.energyAvailable > 40) || ((creep.ticksToLive || 0) < 500)) && !creep.room.spawns[0].spawning) {
          creep.goToRenew(creep.room.spawns[0])
          return
        }
        else if (creep.memory.status == CreepStatus.WAITING_FOR_RENEW) {
          creep.memory.status = CreepStatus.HARVEST
        }
      }

      const carry_amount = _.sum(creep.carry)

      if (!creep.room.attacker_info().attacked && (creep.room.resourceful_tombstones.length > 0) && ((carry_amount - creep.carry.energy) < (creep.carryCapacity - 100))) {
        const target = creep.room.resourceful_tombstones[0]
        const resource_amount = _.sum(target.store) - target.store.energy
        if (resource_amount > 0) {
          const vacancy = creep.carryCapacity - carry_amount
          if (vacancy < resource_amount) {
            creep.drop(RESOURCE_ENERGY, resource_amount - vacancy)
          }

          if (creep.pos.isNearTo(target)) {
            const withdraw_result = creep.withdrawResources(target, {exclude: [RESOURCE_ENERGY]})
            if (withdraw_result != OK) {
              creep.say(`E${withdraw_result}`)
            }
          }
          else {
            creep.moveTo(target)
            creep.say(`${target.pos.x}, ${target.pos.y}`)
          }
          return
        }
        else if ((creep.ticksToLive || 0) < 300) {
          creep.memory.status = CreepStatus.CHARGE
        }
      }

      // if ((creep.memory.status == CreepStatus.NONE) || ((creep.carry[this.resource_type!] || 0) == 0)) { // If the resource is not energy, it should be in the controlled room so resource_type should also be provided
      if (creep.memory.status == CreepStatus.NONE) {
        creep.memory.status = CreepStatus.HARVEST
      }

      // Harvest
      if (creep.memory.status == CreepStatus.HARVEST) {
        if (carry_amount == creep.carryCapacity) {
          creep.memory.status = CreepStatus.CHARGE
        }
        else if ((carry_amount > 0) && (this.harvesters.length == 0)) {
          creep.memory.status = CreepStatus.CHARGE
        }
        else if (creep.room.attacker_info().attacked && (_.sum(creep.carry) > 0) && ((!creep.room.controller || !creep.room.controller.my))) { // If there's no creep in the room, there's no way to know the room is under attack
          creep.say('RUN')
          creep.moveTo(this.destination)
          creep.memory.status = CreepStatus.CHARGE
          return
        }
        else if (this.container) {
          if (creep.pos.isNearTo(this.container)) {
            const withdraw_result = creep.withdraw(this.container!, this.resource_type!)

            if ((withdraw_result == OK) && (this.container) && (this.container.structureType == STRUCTURE_LINK)) {
              // When the carrier withdrow from link, it should be located next to storage
              creep.memory.status = CreepStatus.CHARGE
              return // It needed to make this line work
            }
            else if (withdraw_result != OK) {
              creep.say(`E${withdraw_result}`)
            }
          }
          else {
            let ops: MoveToOpts = {}
            if ((this.source_info.id == '59f1a03882100e1594f36569')) {  // W44S7
              ops = {
                avoid: [new RoomPosition(13, 13, 'W44S7')] // @fixme: temp code
              }
            }
            creep.moveTo(this.container, ops)
          }
        }
        else {
          creep.moveToRoom(this.source_info.room_name)
          return
        }
      }

      // Charge
      if (creep.memory.status == CreepStatus.CHARGE) {

        const has_mineral = creep.carry.energy != _.sum(creep.carry)
        const destination = (has_mineral && !(!this.destination_storage)) ? this.destination_storage : this.destination

        let resource_type: ResourceConstant | undefined
        for (const type of Object.keys(creep.carry)) {
          if ((creep.carry[type as ResourceConstant] || 0) == 0) {
            continue
          }
          resource_type = type as ResourceConstant
        }

        if (resource_type) {
          if (!destination && creep.room.storage && !creep.room.storage.my) {
            const x = 16  // W53S15
            const y = 27

            if ((creep.pos.x == x) && (creep.pos.y == y)) {
              creep.drop(resource_type)
            }
            else {
              creep.moveTo(x, y)
            }
            return
          }
          if (creep.pos.isNearTo(destination)) {
            const transfer_result = creep.transfer(destination, resource_type)
            switch (transfer_result) {
              case ERR_FULL:
                if ((creep.carry[resource_type] || 0) <= 100) {
                  creep.memory.status = CreepStatus.HARVEST
                }
                break

              case OK:
                break

              default:
                console.log(`HarvesterSquad.carry() unexpected transfer result: ${transfer_result}, ${resource_type}, ${creep.name}, ${this.name}, ${this.source_info.room_name}, ${destination}`)
                break
            }
          }
          else {
            creep.moveTo(destination)

            if (creep.carry.energy > 0) {
              if (creep.room.controller && creep.room.controller.my) {
                if (creep.room.owned_structures) {
                  const extensions: StructureExtension[] = creep.room.owned_structures.get(STRUCTURE_EXTENSION) as StructureExtension[]
                  const extension = creep.pos.findInRange(extensions, 1, {
                    filter: (structure: StructureExtension) => {
                      return structure.energy < structure.energyCapacity
                    }
                  })[0]

                  if (extension) {
                    creep.transfer(extension, RESOURCE_ENERGY)
                  }
                  else {
                    const workers = Array.from(this.region.worker_squad.creeps.values())
                    const worker = creep.pos.findInRange(workers, 1, {
                      filter: (creep: Creep) => {
                        return creep.carry.energy < creep.carryCapacity
                      }
                    })[0]

                    if (worker) {
                      creep.transfer(worker, RESOURCE_ENERGY)
                    }
                  }
                }
              }
            }

            if (has_mineral) {
              creep.say(`💎`)
            }
          }
        }
        else {
          creep.memory.status = CreepStatus.HARVEST
        }
      }
    })
  }
}

export interface RunHarvesterOptions {
  resource_type?: ResourceConstant
}

export function runHarvester(creep: Creep, room_name: string, source: Source | Mineral | undefined, store: StructureContainer | StructureLink | StructureStorage | undefined, container: StructureContainer | StructureLink | undefined, opt?: RunHarvesterOptions): void {
  if (creep.spawning) {
    return
  }

  const options = opt || {}
  const resource_type = options.resource_type || RESOURCE_ENERGY

  if (!options.resource_type) {
    options.resource_type = resource_type
  }

  if (!creep.hasActiveBodyPart(CARRY)) {
    if (creep.room.is_keeperroom && (creep.moveToRoom(room_name) == ActionResult.IN_PROGRESS)) {
      return
    }
    if (source) {
      if (creep.pos.isNearTo(source)) {
        creep.harvest(source)
      }
      else {
        const ignoreCreeps = ((Game.time % 5) < 2) ? false : creep.pos.getRangeTo(source) <= 2  // If the blocking creep is next to the source, ignore

        if ((room_name == 'W46S26') && (creep.room.name == 'W45S27')) {
          creep.moveToRoom('W45S26')
          return
        }

        if (store && (store.structureType == STRUCTURE_CONTAINER)) {
          creep.moveTo(store, {
            ignoreCreeps: ignoreCreeps,
          })
        }
        else {
          creep.moveTo(source, {
            ignoreCreeps: ignoreCreeps,
          })
        }
        return
      }
    }
    else {
      creep.moveToRoom(room_name)
      return
    }
    return
  }

  if (((creep.ticksToLive || 0) < 3) && store && (store.structureType != STRUCTURE_LINK)) {
    creep.transferResources(store)
  }

  const needs_renew = !creep.memory.let_thy_die && ((creep.memory.status == CreepStatus.WAITING_FOR_RENEW) || ((creep.ticksToLive || 0) < 300))

  if (needs_renew) {
    if ((creep.room.spawns.length > 0) && ((creep.room.energyAvailable > 40) || ((creep.ticksToLive || 0) < 500)) && !creep.room.spawns[0].spawning) {
      creep.goToRenew(creep.room.spawns[0])
      return
    }
    else if (creep.memory.status == CreepStatus.WAITING_FOR_RENEW) {
      creep.memory.status = CreepStatus.HARVEST
    }
  }

  if ((creep.memory.status == CreepStatus.NONE) || ((creep.carry[resource_type] || 0) == 0)) {
    creep.memory.status = CreepStatus.HARVEST
  }

  // Harvest

  if ((creep.memory.status == CreepStatus.HARVEST) && ((creep.carry[resource_type] || 0) == 0) && store) {
    let has_capacity = false
    if (!store) {
      // Does nothing
    }
    else if (resource_type && (store as StructureContainer).store) {
      const capacity = (store as StructureContainer).storeCapacity
      const energy_amount = _.sum((store as StructureContainer).store)
      has_capacity = (energy_amount < capacity)
    }
    else if (store.structureType == STRUCTURE_LINK) {
      const capacity = (store as StructureLink).energyCapacity
      const energy_amount = (store as StructureLink).energy
      has_capacity = (energy_amount < capacity)
    }

    if (has_capacity && source && (creep.pos.getRangeTo(source) <= 1)) {

      const dropped_object = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 1, {
        filter: (resource: Resource) => {
          return (resource.resourceType == resource_type)
        }
      })[0]

      if (dropped_object) {
        const pickup_result = creep.pickup(dropped_object)
        switch (pickup_result) {
          case OK:
          case ERR_FULL:
            break

          default:
            console.log(`HarvesterSquad.harvest() unexpected pickup result: ${pickup_result}, ${creep.name}, ${creep.pos}, ${room_name}`)
            break
        }
        return
      }
    }

    if (container && store && (container.id != store.id) && (container.structureType == STRUCTURE_CONTAINER) && (container.store.energy > 0)) {
      if (creep.withdraw(container, RESOURCE_ENERGY) == OK) {
        return
      }
    }
  }

  const carrying_energy = creep.carry[resource_type] || 0
  if ((creep.memory.status == CreepStatus.HARVEST) && (carrying_energy > 0) && ((carrying_energy > (creep.carryCapacity - (creep.getActiveBodyparts(WORK) * HARVEST_POWER))) || ((creep.ticksToLive || 0) < 5))) {
    creep.memory.status = CreepStatus.CHARGE
  }

  if (creep.memory.status == CreepStatus.HARVEST) {
    if (creep.room.is_keeperroom && (creep.moveToRoom(room_name) == ActionResult.IN_PROGRESS)) {
      return
    }
    if (source) {
      if (creep.pos.isNearTo(source)) {
        creep.harvest(source)
      }
      else {
        if ((room_name == 'W46S26') && (creep.room.name == 'W45S27')) {
          creep.moveToRoom('W45S26')
          return
        }

        const ignoreCreeps = ((Game.time % 20) <= 10)// ? false : creep.pos.getRangeTo(source) <= 2  // If the blocking creep is next to the source, ignore

        if (store && (store.structureType == STRUCTURE_CONTAINER)) {
          creep.moveTo(store, {
            ignoreCreeps: ignoreCreeps,
          })
        }
        else {
          creep.moveTo(source, {
            ignoreCreeps: ignoreCreeps,
          })
        }
        return
      }
    }
    else {
      creep.moveToRoom(room_name)
      return
    }
  }

  // Charge
  if (creep.memory.status == CreepStatus.CHARGE) {
    if (!store) {
      if (creep.memory.debug) {
        creep.say(`NO store`)
      }
      creep.memory.status = CreepStatus.BUILD
    }
    else if ((resource_type == RESOURCE_ENERGY) && creep.room.controller && creep.room.controller.my && (store.hits < (store.hitsMax * 0.6))) {
      creep.repair(store)
      return
    }
    else if ((resource_type == RESOURCE_ENERGY) && (store.hits < store.hitsMax)) {
      creep.repair(store)
      return
    }
    else {
      let local_store: StructureContainer | StructureLink | StructureStorage = store

      if (creep.pos.isNearTo(local_store)) {
        const transfer_result = creep.transfer(local_store, resource_type)
        switch (transfer_result) {
          case ERR_NOT_IN_RANGE:
            creep.moveTo(store)
            return

          case ERR_FULL:
            if (creep.carry.energy > 0) {
              creep.drop(RESOURCE_ENERGY) // To NOT drop minerals
            }
            break

          case OK:
          case ERR_BUSY:  // @fixme: The creep is still being spawned.
            break

          default:
            console.log(`HarvesterSquad.harvest() unexpected transfer result1: ${transfer_result}, ${resource_type}, ${creep.name}, ${creep.pos}, ${room_name}`)
            break
        }
        creep.memory.status = CreepStatus.HARVEST
      }
      else {
        creep.moveTo(store)
      }
      return
    }
  }

  // Build
  if (creep.memory.status == CreepStatus.BUILD) {
    const target = creep.pos.findInRange(FIND_CONSTRUCTION_SITES, 2)[0] as ConstructionSite

    if (target) {
      const result = creep.build(target)
      if (result != OK) {
        console.log(`HarvesterSquad.harvest build failed ${result}, ${creep.name}, ${creep.pos}, ${room_name}`)
        return
      }
    }
    else {
      if (source) {
        if (creep.pos.getRangeTo(source) == 1) {
          const x_diff = creep.pos.x - source.pos.x
          const y_diff = creep.pos.y - source.pos.y
          const pos = {
            x: creep.pos.x,// + x_diff,
            y: creep.pos.y,// + y_diff,
          }

          const result = creep.room.createConstructionSite(pos.x, pos.y, STRUCTURE_CONTAINER)
          console.log(`HarvesterSquad place container on ${pos.x}, ${pos.y} at ${room_link(room_name)}`)
          creep.memory.status = CreepStatus.HARVEST // @todo: more optimized way
          return
        }
        else {
          creep.drop(RESOURCE_ENERGY)
          creep.memory.status = CreepStatus.HARVEST
          return
        }
      }
      else {
        console.log(`HarvesterSquad.harvest no target source ${creep.name} at ${creep.pos} ${room_name}`)
        return
      }
    }
  }
}
