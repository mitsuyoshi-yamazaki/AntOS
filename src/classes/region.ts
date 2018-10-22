import { ErrorMapper } from "utils/ErrorMapper"
import { Squad, SquadType, SquadMemory, SpawnPriority } from "classes/squad/squad"
import { WorkerSquad } from "classes/squad/worker"
import { ManualSquad } from "classes/squad/manual"
import { HarvesterSquad, HarvesterSquadMemory } from "./squad/harvester"
import { ScoutSquad } from "classes/squad/scout"
import { ActionResult } from "./creep"
import { AttackerSquad } from "./squad/attacker"
import { UpgraderSquad } from "./squad/upgrader";
import { ResearcherSquad, ResearchTarget } from "./squad/researcher";
import { InvaderSquad, InvaderSquadLabs } from "./squad/invader";
import { TempSquad } from "./squad/temp";
import { ChargerSquad } from './squad/charger';
import { RemoteHarvesterSquad, RemoteHarvesterSquadMemory } from './squad/remote_harvester';
import { RemoteMineralHarvesterSquad, RemoteMineralHarvesterSquadMemory } from "./squad/remote_m_harvester";
import { NukerChargerSquad, NukerChargerSquadMemory } from "./squad/nuker_charger";
import { RemoteAttackerSquad } from "./squad/remote_attacker";
import { FarmerSquad, FarmerSquadMemory } from "./squad/farmer";
import { room_link, room_history_link } from "./utils";
import { runTowers, RunTowersOpts } from "./tower";
import { SwarmSquad } from "./squad/swarm";

export interface RegionMemory {
  destination_container_id?: string | null
  upgrader_additional_source_ids?: string[]
  additional_source_link_ids?: string[]
  input_lab_ids?: {lhs: string | null, rhs: string | null}
  destination_link_id?: string | null
  support_link_ids?: string[]
  reaction_outputs?: string[]
  reaction_output_excludes?: string[]
  no_reaction?: boolean
  resource_transports?: {[room_name: string]: ResourceConstant[]}
  send_resources_to?: string[]
  send_resources_to_excludes?: string[]
  charger_position?: {x: number, y: number} | null
  room_need_scout?: string[]
  rooms_need_to_be_defended?: string[]
  observe_target?: string | null
  observe_index: number
  excluded_walls?: string[]
  public_ramparts?: string[]
  repairing_wall_id?: string | null
  wall_max_hits?: number | null
  last_spawn_time: number
  last_heavy_attacker?: {ticks: number, body: string[], teams: string[]} | null
  ancestor: string
  region_version: string
  sign: string | null
}

export interface RegionOpt {
  produce_attacker: boolean,
  attack_to: string | null,
  temp_squad_opt?: {target_room_name: string, forced?: boolean}
  send_to_energy_threshold: number,
  should_send_resources: boolean,
}

export class Region {
  // Public
  public get room(): Room {
    return this.controller.room
  }
  public get name(): string {
    return this.room.name
  }
  public delegated_squads: Squad[] = []
  public squads_need_spawn: Squad[] = []

  // Private
  private squads = new Map<string, Squad>()
  private destination_link_id: string | undefined
  worker_squad: WorkerSquad
  private spawns = new Map<string, StructureSpawn>()
  private attacked_rooms: string[] = []
  private no_instantiations: string[] = []

  private get support_link_ids(): string[] {
    const region_memory = Memory.regions[this.name]
    if (!region_memory || !region_memory.support_link_ids) {
      return []
    }
    return region_memory.support_link_ids
  }

  constructor(readonly controller: StructureController, readonly region_opt: RegionOpt) {
    if (!controller || !controller.my) {
      const message = `Region() controller not provided or not mine ${controller}`
      console.log(message)
      Game.notify(message)

      // dummy
      this.worker_squad = new WorkerSquad('', this.room)
      return
    }

    const room_memory = Memory.rooms[this.room.name] as RoomMemory | undefined

    if (!Memory.regions[this.name]) {
      const ancestor = (!(!room_memory) && !(!room_memory.ancestor)) ? room_memory.ancestor : 'origin'

      Memory.regions[this.name] = {
        reaction_outputs: [],
        resource_transports: {},
        destination_container_id: null,
        input_lab_ids: {lhs: null, rhs: null},
        destination_link_id: null,
        support_link_ids: [],
        upgrader_additional_source_ids: [],
        additional_source_link_ids: [],
        charger_position: null,
        room_need_scout: [],
        rooms_need_to_be_defended: [],
        observe_target: null,
        observe_index: 0,
        excluded_walls: [],
        public_ramparts: [],
        repairing_wall_id: null,
        wall_max_hits: 20000000,  // 20M
        last_spawn_time: Game.time,
        last_heavy_attacker: null,
        ancestor,
        region_version: Game.version,
        sign: Game.version,
      }

      this.create_squad_memory()
    }
    const region_memory = Memory.regions[this.name]

    // region_memory.region_version = (this.controller.sign || {text: 'none'}).text

    // Spawns
    if (this.room.owned_structures) {
      const spawn_list = this.room.owned_structures.get(STRUCTURE_SPAWN)

      if (spawn_list) {
        spawn_list.forEach((structure) => {
          const spawn = structure as StructureSpawn
          this.spawns.set(spawn.name, spawn)
        })
      }
    }

    if ((this.spawns.size == 0)) {
      if (this.room.controller && (this.room.controller.level >= 3)) {
        this.room.owned_structures_not_found_error(STRUCTURE_SPAWN)
      }
      this.room.find(FIND_MY_SPAWNS).forEach((spawn) => {
        this.spawns.set(spawn.name, spawn)
      })
    }

    this.spawns.forEach((spawn, _) => {
      spawn.initialize()
    })

    // --- Initialize variables ---
    const storage = (this.room.storage && this.room.storage.my) ? this.room.storage : undefined
    const terminal = (this.room.terminal && this.room.terminal.my) ? this.room.terminal : undefined

    let harvester_targets: {id: string, room_name: string}[] = []
    let harvester_destination: StructureStorage | StructureTerminal | StructureContainer = (storage || terminal) as (StructureStorage | StructureTerminal) // @fixme: null check // || container
    let rooms_need_scout: string[] = []
    let rooms_need_to_be_defended: string[] = []
    let research_input_targets: ResearchTarget[] = []
    let research_output_targets: ResearchTarget[] = []
    const energy_capacity = this.room.energyCapacityAvailable - 50
    let charger_position: {x: number, y: number} | undefined
    let input_lab_ids: {lhs: string, rhs: string} | undefined

    switch (this.room.name) {
      case 'W51S29':
        harvester_targets = [
          { id: '59f19fd382100e1594f35a4c', room_name: 'W51S29' }, // bottom right
          { id: '59f19fd382100e1594f35a4b', room_name: 'W51S29' }, // bottom center
          { id: '59f1c0ce7d0b3d79de5f0165', room_name: 'W51S29' }, // Lemergium
        ]
        rooms_need_scout = []//['W51S21']
        this.destination_link_id = '5b1f028bb08a2b269fba0f6e'
        charger_position = {x: 24, y: 21}
        break

      case 'W44S7':
        harvester_targets = [
          { id: '59f1a03882100e1594f36569', room_name: 'W44S7' } , // top
          { id: '59f1a03882100e1594f3656b', room_name: 'W44S7' } , // bottom
          { id: '59f1c0cf7d0b3d79de5f037c', room_name: 'W44S7' } , // hydrogen
        ]
        this.destination_link_id = '5b2e775359615412454b065e'
        charger_position = {x: 19, y: 42}
        input_lab_ids = {
          lhs: '5b3b4987f8c7fa739a68e406', // 18, 32
          rhs: '5b32af23c3f6e64781782851', // 17, 33
        }
        // this.temp_squad_target_room_name = 'W39S9'
        break

      case 'W48S6':
        harvester_targets = [
          { id: '59f19ffa82100e1594f35d81', room_name: 'W48S6' }, // center
          { id: '59f19ffa82100e1594f35d82', room_name: 'W48S6' }, // bottom
          { id: '59f1c0ce7d0b3d79de5f0228', room_name: 'W48S6' }, // hydrogen
          { id: '59f19feb82100e1594f35c03', room_name: 'W49S6' }, // top
          { id: '59f19feb82100e1594f35c05', room_name: 'W49S6' }, // bottom
        ]
        rooms_need_scout = [
          // 'W49S6',
          // 'W48S5',
          'W48S7',
          'W49S5',
        ]
        rooms_need_to_be_defended = [
          // 'W49S6',
          'W48S5',
          'W48S7',
          'W49S5',
        ]
        charger_position = {x: 35, y: 22}
        this.destination_link_id = '5b34e943bb6c0934e8274579'
        input_lab_ids = {
          lhs: '5b358e1d24c2d964cdd22578', // 41, 22
          rhs: '5b35ab4b2ffd7a7b7f48fb7d', // 42, 21
        }
        break

      case 'W43S5':
        harvester_targets = [
          { id: '59f1a04682100e1594f36736', room_name: 'W43S5' },
          { id: '59f1c0cf7d0b3d79de5f03d7', room_name: 'W43S5' }, // utrium
        ]
        rooms_need_scout = [
          'W42S5',
          'W43S4',
          'W42S4',
        ]
        rooms_need_to_be_defended = [
          'W42S5',
          'W43S4',
          'W42S4',
          // 'W45S5',
        ]
        this.destination_link_id = '5b317f135c9e085b93bedf0c'
        charger_position = {x: 19, y: 16}
        input_lab_ids = {
          lhs: '5b3a25ac4db5b770faec5a37', // 15, 11
          rhs: '5b3a1d976ee50a3f1cb8e34f', // 16, 10
        }
        break

      case 'W47S6':
        harvester_targets = [
          { id: '59f1a00982100e1594f35f04', room_name: 'W47S6' }, // left
          { id: '59f1a00982100e1594f35f03', room_name: 'W47S6' }, // center
          { id: '59f1c0ce7d0b3d79de5f0294', room_name: 'W47S6' }, // lemergium
        ]
        rooms_need_to_be_defended = [
          'W47S7'
        ]
        this.destination_link_id = '5b540f0e36c4ca4dbc341b2c'
        charger_position = {x: 11, y: 20}
        input_lab_ids = {
          lhs: '5b56ca191a797e4b745737e9', // 9, 26
          rhs: '5b56d9e4c5d418727d66f8ec', // 10, 27
        }
        break

      case 'W45S27':
        harvester_targets = [
          { id: '59f1c0cf7d0b3d79de5f0340', room_name: 'W45S27' },  // Utrium
        ]
        rooms_need_to_be_defended = [
          'W45S28',
          'W46S28',
        ]
        this.destination_link_id = '5b5ad89d3c93de26f63169b1'
        charger_position = {x: 19, y:35}
        break

      case 'W47S9':
        harvester_targets = [
          { id: '59f1c0ce7d0b3d79de5f0297', room_name: 'W47S9' },  // Catalyst
        ]
        rooms_need_to_be_defended = [
          'W46S9',
          'W47S8',
        ]
        this.destination_link_id = '5b5908afdabde472b944723d'
        charger_position = {x: 38, y: 7}
        break

      case 'W46S3':
        harvester_targets = [
          { id: '59f1c0cf7d0b3d79de5f02eb', room_name: 'W46S3' }, // Oxygen
        ]
        this.destination_link_id = '5b5a68650f98906de3d32601'
        charger_position = {x: 34, y: 43}
        break

      case 'E16N37':
        harvester_targets = [
          { id: '59f1a40f82100e1594f3c718', room_name: 'E16N37' },  // bottom
          { id: '59f1a40f82100e1594f3c716', room_name: 'E16N37' },  // right
          { id: '59f1c0de7d0b3d79de5f17a3', room_name: 'E16N37' },  // Keanium
        ]
        rooms_need_to_be_defended = [
          'E15N37',
          'E15N38',
          'E14N37',
        ]
        this.destination_link_id = '5b5ee6ae663ee267f5286cc5'
        charger_position = {x: 13, y: 29}
        break

      case 'W56S7':
        harvester_targets = [
          { id: '59f1c0cd7d0b3d79de5eff8c', room_name: 'W56S7' }, // Catalyst
        ]
        break

      case 'W55S23':
        harvester_targets = [
          { id: '59f1c0cd7d0b3d79de5effdf', room_name: 'W55S23' }, // Hydrogen
        ]
        break

      case 'W55S13':
        harvester_targets = [
          { id: '59f1c0cd7d0b3d79de5effd9', room_name: 'W55S13' },  // Oxygen
        ]
        break

      case 'W58S4':
        harvester_targets = [
          { id: '59f1c0cc7d0b3d79de5efec6', room_name: 'W58S4' },  // Hydrogen
        ]
        break

      case 'W54S7': {
        harvester_targets = [
          { id: '59f1c0cd7d0b3d79de5f001c', room_name: 'W54S7' },  // Hydrogen
        ]
        break
      }

      case 'W45S3': {
        harvester_targets = [
          { id: '59f1c0cf7d0b3d79de5f0333', room_name: 'W45S3' },  // Hydrogen
        ]
        break
      }

      case 'W53S15': {
        harvester_targets = [
          { id: '59f1c0cd7d0b3d79de5f0080', room_name: 'W53S15' },  // Oxygen
        ]
        break
      }

      case 'W53S5': {
        harvester_targets = [
          { id: '59f1c0cd7d0b3d79de5f0077', room_name: 'W53S5' },  // Keanium
        ]
        break
      }

      case 'W57S4': {
        harvester_targets = [
          { id: '59f1c0cc7d0b3d79de5eff32', room_name: 'W57S4' },  // Hydrogen
        ]
        break
      }

      default:
        // console.log(`Region.initialize unexpected region name, ${this.name}`)
        break
    }

    // -- harvester
    const time = (Game.time % 997)
    const check_harvester = (time == 23) || (time == 24)

    if (check_harvester && (this.controller.level == 4) && (this.room.energyCapacityAvailable >= 1200)) {
      // Add harvester targets
      const harvester_target_ids = harvester_targets.map((target) => {
        return target.id
      })

      this.room.sources.forEach((source) => {
        if (harvester_target_ids.indexOf(source.id) >= 0) {
          return
        }

        harvester_targets.push({ id: source.id, room_name: this.room.name })
      })
      // console.log(`${this.name}: ${fuga.map(t=>[t.id, t.room_name])}`)
    }

    // -- researcher
    if (region_memory.input_lab_ids && region_memory.input_lab_ids.lhs && region_memory.input_lab_ids.rhs) {
      input_lab_ids = {
        lhs: region_memory.input_lab_ids.lhs,
        rhs: region_memory.input_lab_ids.rhs,
      }
    }

    if ((Game.time % 103) == 13) {
      if ((this.controller.level >= 6) && !input_lab_ids) {
        console.log(`Region ${this.name} is upgraded to level ${this.controller.level} but no input_lab_ids`)
      }
    }

    // -- scout
    if (region_memory.room_need_scout) {
      region_memory.room_need_scout.forEach((room_name) => {
        if (rooms_need_scout.indexOf(room_name) >= 0) {
          return
        }
        rooms_need_scout.push(room_name)
      })
    }

    // -- harvester destination
    if (!harvester_destination && region_memory.destination_container_id) {
      const destination_container = Game.getObjectById(region_memory.destination_container_id) as StructureContainer | undefined

      if (destination_container && (destination_container.structureType == STRUCTURE_CONTAINER)) {
        harvester_destination = destination_container
      }
      else {
        const message = `Region.memory destination_container_id ${region_memory.destination_container_id} not found or not container ${destination_container}, ${!destination_container ? 'none' : destination_container.pos}, ${this.name}`
        console.log(message)
        Game.notify(message)

        region_memory.destination_container_id = undefined
      }
    }

    // -- destination link
    if (region_memory.destination_link_id) {
      this.destination_link_id = region_memory.destination_link_id
    }

    // -- charger position
    if (region_memory.charger_position) {
      charger_position = region_memory.charger_position
    }

    // -- reaction
    if (region_memory.reaction_outputs && input_lab_ids && this.room.terminal) {
      const output = region_memory.reaction_outputs[0]

      if (output) {
        const ingredients = Game.reactions[output]

        if (ingredients) {
          let finished = false

          if (((Game.time % 101) == 0)) {
            let input_lab_l = Game.getObjectById(input_lab_ids.lhs) as StructureLab | undefined
            let input_lab_r = Game.getObjectById(input_lab_ids.rhs) as StructureLab | undefined
            const minimum_amount = 20

            if (input_lab_l && (!input_lab_l.mineralType || (ingredients.lhs == input_lab_l.mineralType))) {
              const amount = (this.room.terminal.store[ingredients.lhs] || 0) + input_lab_l.mineralAmount
              if ((amount < minimum_amount)) {
                finished = true
              }
            }
            if (input_lab_r && (!input_lab_r.mineralType || (ingredients.rhs == input_lab_r.mineralType))) {
              const amount = (this.room.terminal.store[ingredients.rhs] || 0) + input_lab_r.mineralAmount
              if ((amount < minimum_amount)) {
                finished = true
              }
            }

            Memory.regions[this.name].no_reaction = finished
          }

          if (finished && (region_memory.reaction_outputs.length > 1)) {//0)) { // to continue reaction after new resource sent
            Memory.regions[this.name].reaction_outputs!.shift()
          }
          else {
            research_input_targets = [
              {
                id: input_lab_ids.lhs,
                resource_type: ingredients.lhs,
              },
              {
                id: input_lab_ids.rhs,
                resource_type: ingredients.rhs,
              },
            ]

            let labs: StructureLab[] | undefined
            if (this.room.owned_structures) {
              labs = this.room.owned_structures.get(STRUCTURE_LAB) as StructureLab[]
            }

            if (!labs) {
              this.room.owned_structures_not_found_error(STRUCTURE_LAB)
              labs = this.room.find(FIND_MY_STRUCTURES) as StructureLab[]
            }

            research_output_targets = labs.filter((structure) => {
              let input_target_ids = research_input_targets.map(t=>t.id)
              if (structure.structureType != STRUCTURE_LAB) {
                return false
              }
              if (input_target_ids.indexOf(structure.id) >= 0) {
                return false
              }
              if (region_memory.reaction_output_excludes && (region_memory.reaction_output_excludes.indexOf(structure.id) >= 0)) {
                return false
              }
              return true
            }).map((lab) => {
              const target: ResearchTarget = {
                id: lab.id,
                resource_type: output as ResourceConstant,  // this is output
              }
              return target
            })

            // console.log(`${this.name}`)
            // research_input_targets.forEach((a) => {
            //   console.log(`input ${a.id}: ${a.resource_type}`)
            // })

            // research_output_targets.forEach((b) => {
            //   console.log(`output ${b.id}: ${b.resource_type}`)
            // })
          }
        }
        else {
          let reason: string

          if (RESOURCES_ALL.indexOf(output as ResourceConstant) < 0) {
            Memory.regions[this.name].reaction_outputs!.shift()
            reason = ``
          }
          else {
            reason = `Unknown`
          }

          const message = `Region no ingredients found for ${output}, ${this.name}`
          console.log(message)
          Game.notify(message)
        }
      }
      else {
        if ((Game.time % 101) == 3) {
          const message = `No reaction ${this.name}`
          console.log(message)
          // Game.notify(message)
        }
      }
    }

    // --
    rooms_need_to_be_defended.push(this.room.name)

    if (region_memory.rooms_need_to_be_defended && (region_memory.rooms_need_to_be_defended.length > 0)) {
      rooms_need_to_be_defended = rooms_need_to_be_defended.concat(region_memory.rooms_need_to_be_defended)
    }

    this.attacked_rooms = rooms_need_to_be_defended.map((room_name) => {
      const room_memory = Memory.rooms[room_name]
      if (room_memory && room_memory.attacked_time) {
        return room_name
      }
      return null
    }).filter((room_name) => {
      return !(!room_name)
    }) as string[]

    if ((this.attacked_rooms.length > 0) && ((Game.time % 13) == 5)) {
      const rooms = this.attacked_rooms.map(room_name => {
        const color = (room_name == this.room.name) ? '#E74C3C' : '#FFFFFF'
        return room_link(room_name, {color})
      })
      const room_histories = this.attacked_rooms.map(room_name => {
        const color = (room_name == this.room.name) ? '#E74C3C' : '#FFFFFF'
        return room_history_link(room_name, Game.time, {color})
      })

      const be = (rooms.length <= 1) ? 'is' : 'are'
      const message = `${rooms} ${be} attacked!! ${room_link(this.room.name)} (${room_histories})`
      console.log(message)
      // Game.notify(message)
    }

    // -- Memory --
    let worker_squad: WorkerSquad | null = null

    for (const squad_name in Memory.squads) {
      const squad_memory = Memory.squads[squad_name]
      if (squad_memory.owner_name != this.name) {
        continue
      }

      if (squad_memory.stop_spawming || squad_memory.no_instantiation) {
        // if (squad_memory.type == SquadType.INVADER) {
        //   console.log(`${squad_memory.name}`)
        // }
        this.no_instantiations.push(`    - ${squad_memory.name}`)
        continue
      }

      ErrorMapper.wrapLoop(() => {
        switch (squad_memory.type) {
          case SquadType.WORKER: {
            const opts: {source?: StructureContainer | undefined, additional_container_ids?: string[]} = {}
            if (harvester_destination && (harvester_destination.structureType == STRUCTURE_CONTAINER)) {
              opts.source = harvester_destination
            }

            if (region_memory.upgrader_additional_source_ids) {
              opts.additional_container_ids = region_memory.upgrader_additional_source_ids
            }

            const squad = new WorkerSquad(squad_memory.name, this.room, opts)
            worker_squad = squad
            this.squads.set(squad.name, squad)
            break
          }
          case SquadType.UPGRADER: {
            if (UpgraderSquad.need_instantiation(squad_memory, this.controller)) {
              const squad = new UpgraderSquad(squad_memory.name, this.room.name, region_memory.upgrader_additional_source_ids || [])
              this.squads.set(squad.name, squad)
            }
            else {
              this.no_instantiations.push(`    - ${squad_memory.name}`)
            }
            break
          }
          case SquadType.CHARGER: {

            if (ChargerSquad.need_instantiation(squad_memory, this.controller)) {
              if (!charger_position) {
                const message = `Region charger_position for room ${this.room.name}`
                if ((Game.time % 29) == 5) {
                  console.log(message)
                  // Game.notify(message)
                }
                break
              }

              const link = Game.getObjectById(this.destination_link_id) as StructureLink | undefined
              const support_links: StructureLink[] = this.support_link_ids.map((id) => {
                return Game.getObjectById(id) as StructureLink | undefined
              }).filter((l) => {
                if (!l) {
                  return false
                }
                return true
              }) as StructureLink[]

              const opts: {additional_links?: StructureLink[]} = {}

              if (region_memory && region_memory.additional_source_link_ids) {
                opts.additional_links = region_memory.additional_source_link_ids.map((id) => {
                  return Game.getObjectById(id) as StructureLink
                }).filter((l) => {
                  return !(!l)
                })
              }

              const squad = new ChargerSquad(squad_memory.name, this.room, link, support_links, charger_position, opts)

              this.squads.set(squad.name, squad)
            }
            else {
              this.no_instantiations.push(`    - ${squad_memory.name}`)
            }
            break
          }
          case SquadType.RESEARCHER: {
            if (ResearcherSquad.need_instantiation(squad_memory, this.controller)) {
              const squad = new ResearcherSquad(squad_memory.name, this.room.name, research_input_targets, research_output_targets, {})
              this.squads.set(squad.name, squad)
            }
            else {
              this.no_instantiations.push(`    - ${squad_memory.name}`)
            }
            break
          }
          case SquadType.HARVESTER: {
            const harvester_squad_memory = squad_memory as HarvesterSquadMemory
            const source_info = {
              id: harvester_squad_memory.source_id,
              room_name: harvester_squad_memory.room_name,
            }

            // if (harvester_squad_memory.room_name == 'W49S6') {
            //   this.no_instantiations.push(`    - ${squad_memory.name}`)
            //   break
            // }

            const squad = new HarvesterSquad(squad_memory.name, source_info, harvester_destination, energy_capacity, this)
            this.squads.set(squad.name, squad)
            break
          }
          case SquadType.REMOET_HARVESTER: {
            const remote_harvester_squad_memory = squad_memory as RemoteHarvesterSquadMemory

            const squad = new RemoteHarvesterSquad(squad_memory.name, this.room, remote_harvester_squad_memory.room_name, Object.keys(remote_harvester_squad_memory.sources), harvester_destination, energy_capacity, this)
            this.squads.set(squad.name, squad)
            break
          }
          case SquadType.REMOET_M_HARVESTER: {
            if (!this.room.storage) {
              if ((this.controller.level > 4) && ((Game.time % 41) == 5)) {
                console.log(`NO storage in ${this.room.name} stop remote harvester squad`)
              }
              this.no_instantiations.push(`    - ${squad_memory.name}`)
              break
            }

            const squad = new RemoteMineralHarvesterSquad(squad_memory.name, this.room.storage)
            this.squads.set(squad.name, squad)
            break
          }
          case SquadType.MANUAL: {
            if (['W48S6'].indexOf(this.room.name) >= 0) {
              const squad = new ManualSquad(squad_memory.name, this.room.name, this.room)
              this.squads.set(squad.name, squad)
            }
            else {
              this.no_instantiations.push(`    - ${squad_memory.name}`)
            }
            break
          }
          case SquadType.SCOUT: {
            if ((rooms_need_scout.length > 0) && ScoutSquad.need_instantiation(squad_memory, this.controller)) {
              const squad = new ScoutSquad(squad_memory.name, rooms_need_scout)
              this.squads.set(squad.name, squad)
            }
            else {
              this.no_instantiations.push(`    - ${squad_memory.name}`)
            }
            break
          }
          case SquadType.ATTACKER: {
            const squad = new AttackerSquad(squad_memory.name, this.attacked_rooms, this.room, energy_capacity)

            this.squads.set(squad.name, squad)
            break
          }
          case SquadType.INVADER: {
            let opt_labs: InvaderSquadLabs | null = null

            if (region_memory && region_memory.reaction_output_excludes) {
              const labs = region_memory.reaction_output_excludes.map((id) => {
                return Game.getObjectById(id) as StructureLab | undefined
              }).filter((lab) => {
                if (!lab) {
                  return false
                }
                if (lab.structureType != STRUCTURE_LAB) {
                  return false
                }
                return true
              }) as StructureLab[]

              if (labs.length >= 4) {
                opt_labs = {
                  move: labs[0],
                  heal: labs[1],
                  tough: labs[2],
                  dismantle: labs[3],
                }
              }
            }

            const squad = new InvaderSquad(squad_memory.name, this.room, opt_labs)
            this.squads.set(squad.name, squad)
            break
          }
          case SquadType.SWARM: {
            const squad = new SwarmSquad(squad_memory.name, this.room)
            this.squads.set(squad.name, squad)
            break
          }
          case SquadType.TEMP: {
            if (region_opt.temp_squad_opt) {
              // Creating squad costs CPU
              const temp_squad_target_room = Game.rooms[region_opt.temp_squad_opt.target_room_name]
              const not_my_room = (!temp_squad_target_room || !temp_squad_target_room.controller || !temp_squad_target_room.controller.my)
              const owned = !(!region_opt.temp_squad_opt.forced) && temp_squad_target_room && (temp_squad_target_room.controller && (temp_squad_target_room.controller.level >= 5))

              if (not_my_room || !owned) {
                const squad = new TempSquad(squad_memory.name, this.room.name, region_opt.temp_squad_opt.target_room_name, !(!region_opt.temp_squad_opt.forced))
                this.squads.set(squad.name, squad)
              }
              else {
                this.no_instantiations.push(`    - ${squad_memory.name}`)
              }
            }
            else {
              this.no_instantiations.push(`    - ${squad_memory.name}`)
            }
            break
          }
          case SquadType.NUKER_CHARGER_SQUAD: {
            if (['dummy'].indexOf(this.room.name) >= 0) {
              const squad = new NukerChargerSquad(squad_memory.name, this.room)
              this.squads.set(squad.name, squad)
            }
            else {
              this.no_instantiations.push(`    - ${squad_memory.name}`)
            }
            break
          }
          case SquadType.REMOTE_ATTACKER: {
            // console.log(`REMOTE_ATTACKER ${squad_memory.name}`)

            if (this.region_opt.produce_attacker && this.region_opt.attack_to) {
              const squad = new RemoteAttackerSquad(squad_memory.name, this.room, this.region_opt.attack_to)

              this.squads.set(squad.name, squad)
            }
            break
          }
          case SquadType.FARMER: {
            const farmer_squad_memory = squad_memory as FarmerSquadMemory
            const farmer_room = Game.rooms[farmer_squad_memory.room_name]
            if (!farmer_room || !farmer_room.controller || !farmer_room.controller.my) {
              this.no_instantiations.push(`    - ${squad_memory.name}`)
              break
            }
            const squad = new FarmerSquad(squad_memory.name, this.room, farmer_squad_memory.room_name)

            this.squads.set(squad.name, squad)
            break
          }
          default:
            console.log(`Unexpected squad type ${squad_memory.type}, ${squad_memory.name}, ${this.name}`)
            break
          }
        }, `Squad.init ${this.room.name} ${squad_memory.name}`)()
    }

    // --- Worker ---
    if (!worker_squad) {
      const name = `worker_${this.room.name.toLowerCase()}` //WorkerSquad.generateNewName()
      const opts: {source?: StructureContainer | undefined, additional_container_ids?: string[]} = {}
      if (harvester_destination && (harvester_destination.structureType == STRUCTURE_CONTAINER)) {
        opts.source = harvester_destination
      }
      if (region_memory.upgrader_additional_source_ids) {
        opts.additional_container_ids = region_memory.upgrader_additional_source_ids
      }

      const squad = new WorkerSquad(name, this.room, opts)

      worker_squad = squad
      this.squads.set(squad.name, squad)

      const memory: SquadMemory = {
        name: squad.name,
        type: squad.type,
        owner_name: this.name,
        number_of_creeps: 0,
      }
      Memory.squads[squad.name] = memory

      console.log(`Create worker for ${this.name}, assigned: ${squad.name}`)
    }
    this.worker_squad = worker_squad as WorkerSquad

    // --- Harvester ---
    for (const target of harvester_targets) {
      // Initialize
      if (!Memory.rooms[target.room_name]) {
        Memory.rooms[target.room_name] = {
          harvesting_source_ids: []
        }
      }
      if (!Memory.rooms[target.room_name].harvesting_source_ids) {
        Memory.rooms[target.room_name].harvesting_source_ids = []
      }

      // --
      if (Memory.rooms[target.room_name].harvesting_source_ids.indexOf(target.id) >= 0) {
        continue
      }
      Memory.rooms[target.room_name].harvesting_source_ids.push(target.id)

      const name = HarvesterSquad.generateNewName()
      const squad = new HarvesterSquad(name, target, harvester_destination, energy_capacity, this)

      this.squads.set(squad.name, squad)

      const memory: HarvesterSquadMemory = {
        name: squad.name,
        type: squad.type,
        owner_name: this.name,
        source_id: target.id,
        room_name: target.room_name,
        number_of_creeps: 0,
      }
      Memory.squads[squad.name] = memory

      console.log(`Create harvester for ${target.room_name} ${target.room_name}, assigned: ${squad.name}`)
      break // To not create squads with the same name
    }

    // --- Spawn ---
    const sorted = Array.from(this.squads.values()).sort(function(lhs, rhs) {
      const l_priority = lhs.spawnPriority
      const r_priority = rhs.spawnPriority
      if (l_priority < r_priority) return -1
      else if (l_priority > r_priority) return 1
      else return 0
    })

    const highest_priority = sorted[0].spawnPriority
    const availableEnergy = this.room.energyAvailable
    const worker_squad_name = this.worker_squad.name

    this.squads_need_spawn = highest_priority == SpawnPriority.NONE ? [] : sorted.filter((squad) => {
      return (squad.spawnPriority == highest_priority)
    })

    // Research
    if ((research_input_targets.length == 2) && (research_output_targets.length > 0)) {
      const input_lab1 = Game.getObjectById(research_input_targets[0].id) as StructureLab
      const input_lab2 = Game.getObjectById(research_input_targets[1].id) as StructureLab

      if ((input_lab1.mineralType == research_input_targets[0].resource_type) && (input_lab2.mineralType == research_input_targets[1].resource_type)) {
        research_output_targets.forEach((target) => {
          const output_lab = Game.getObjectById(target.id) as StructureLab
          const reaction_result = output_lab.runReaction(input_lab1, input_lab2)

          switch(reaction_result) {
            case OK:
            case ERR_NOT_ENOUGH_RESOURCES:
            case ERR_FULL:
            case ERR_TIRED:
              break

            default:
              if ((Game.time % 23) == 11) {
                console.log(`Lab.runReaction failed with ${reaction_result}, ${this.name}, ${output_lab.pos} in ${room_link(output_lab.room.name)}`)
              }
              break
          }
        })
      }
    }
  }

  public say(message: string): void {
    this.squads.forEach((squad, _) => {
      squad.say(message)
    })
  }

  public run(): void {
    const region_memory = Memory.regions[this.name] as RegionMemory | undefined

    if ((Game.time % 101) == 13) {
      ErrorMapper.wrapLoop(() => {
        this.watchDog()
      }, `${this.name}.watchDog`)()
    }

    ErrorMapper.wrapLoop(() => {
      this.activateSafeModeIfNeeded()
    }, `${this.name}.activateSafeModeIfNeeded`)()

    ErrorMapper.wrapLoop(() => {
      let towers: StructureTower[] = []

      if (this.room.owned_structures) {
        towers = this.room.owned_structures.get(STRUCTURE_TOWER) as StructureTower[]
      }

      if (!towers || (towers.length == 0)) {
        if (this.room.controller && (this.room.controller.level >= 3)) {
          this.room.owned_structures_not_found_error(STRUCTURE_TOWER)
        }

        towers = this.room.find(FIND_MY_STRUCTURES, {
          filter: (structure) => {
            return structure.structureType == STRUCTURE_TOWER
          }
        }) as StructureTower[]
      }

      const opts: RunTowersOpts = {}

      if (region_memory) {
        if ((Game.time % 5) == 2) {
          region_memory.repairing_wall_id = undefined
        }
        else if (region_memory.repairing_wall_id) {
          opts.repairing_wall_id = region_memory.repairing_wall_id
        }

        if (region_memory.wall_max_hits) {
          opts.wall_max_hits = region_memory.wall_max_hits
        }

        if (region_memory.excluded_walls) {
          opts.excluded_wall_ids = region_memory.excluded_walls
        }
      }

      const repairing_wall_id = runTowers(towers, this.room, opts)

      if (region_memory) {
        region_memory.repairing_wall_id = repairing_wall_id
      }
    }, `${this.name}.runTowers`)()

    ErrorMapper.wrapLoop(() => {
      if (region_memory && region_memory.public_ramparts) {
        const should_public = this.room.attacker_info().hostile_creeps.length == 0

        region_memory.public_ramparts.forEach((id) => {
          const rampart = Game.getObjectById(id) as StructureRampart | undefined
          if (!rampart || (rampart.structureType != STRUCTURE_RAMPART)) {
            console.log(`${this.name} rampart ${id} is not exists`)
            return
          }

          if (rampart.isPublic != should_public) {
            rampart.setPublic(should_public)
          }
        })
      }
    }, `${this.name}.public ramparts`)()

    this.squads.forEach((squad, _) => {
      ErrorMapper.wrapLoop(() => {
        squad.run()
      }, `${squad.name}.run ${squad.description()}`)()
    })

    ErrorMapper.wrapLoop(() => {
      this.transferLinks()
    }, `${this.name}.transferLinks`)()

    ErrorMapper.wrapLoop(() => {
      this.spawnAndRenew()
    }, `${this.name}.spawnAndRenew`)()

    ErrorMapper.wrapLoop(() => {
      const nuke: Nuke = this.room.find(FIND_NUKES, {
        filter: (nuke) => {
          console.log(`Nuke detected ${this.room.name}`)
          return (nuke.timeToLand < 100)
        }
      })[0]

      if (nuke) {
        let creeps: Creep[] = []

        this.squads.forEach((squad) => {
          const c = Array.from(squad.creeps.values()).filter((cc) => {
            return cc.room.name == this.room.name
          })
          creeps = creeps.concat(c)
        })

        let room_name: string

        switch (this.room.name) {
          case 'W48S47':
            room_name = 'W48S48'
            break

          default:
            room_name = 'W48S48'  // better than nothing
            break
        }

        creeps.forEach((c) => {
          if (c.moveToRoom(room_name) == ActionResult.IN_PROGRESS) {
            return
          }
          c.moveTo(26, 11)
        })
      }
    }, `${this.name}.findNuke`)()

    ErrorMapper.wrapLoop(() => {
      let power_spawns: StructurePowerSpawn[] | undefined

      if (this.room.owned_structures) {
        power_spawns = this.room.owned_structures.get(STRUCTURE_POWER_SPAWN) as StructurePowerSpawn[]
      }

      if (power_spawns) {
        power_spawns.forEach((power_spawn) => {
          power_spawn.processPower()
        })
      }
    }, `${this.name}.processPower`)()

    if ((Game.time % 101) == 0) {
      ErrorMapper.wrapLoop(() => {
        this.placeConstructionSite()
      }, `${this.name}.placeConstructionSite`)()
    }

    if (this.region_opt.should_send_resources) {
      ErrorMapper.wrapLoop(() => {
        this.sendResources()
      })()
    }

    ErrorMapper.wrapLoop(() => {
      this.sendResourcesTo()
    }, `${this.name}.sendResourcesTo`)()

    ErrorMapper.wrapLoop(() => {
      this.runObserver()
    }, `${this.name}.runObserver`)()

    ErrorMapper.wrapLoop(() => {
      this.drawDebugInfo()
    }, `${this.name}.drawDebugInfo`)()

    // ErrorMapper.wrapLoop(() => {
    //   if ((this.room.name == 'W43N5') || (this.room.name == 'W47N5')) {
    //     this.room.find(FIND_STRUCTURES).forEach((s) => {
    //       s.notifyWhenAttacked(false)
    //     })
    //   }
    // })()
  }

  // --- Private ---
  private runObserver(): void {
    if (!this.room.owned_structures) {
      return
    }
    const observers = this.room.owned_structures.get(STRUCTURE_OBSERVER) as StructureObserver[] | undefined
    if (!observers) {
      return
    }

    const observer = observers[0]
    if (!observer) {
      return
    }

    const region_memory = Memory.regions[this.name] as RegionMemory | undefined
    if (!region_memory) {
      console.log(`Region.runObserver unexpectedly no region_memory, ${this.name}`)
      return
    }

    if (region_memory.observe_target) {
      const result = observer.observeRoom(region_memory.observe_target)
      if (result == OK) {
        if (Memory.debug.show_visuals) {
          const room = Game.rooms[region_memory.observe_target]

          if (room) {
            room.visual.text(`${this.name} is observing`, 48, 1, {
              align: 'right',
              opacity: 1.0,
              font: '12px',
              color: '#ffff00',
            })
          }
        }
      }
      else {
        console.log(`Region.runObserver failed with ${result}, ${this.name}, observing ${region_memory.observe_target}, ${region_memory.observe_target == null}`)
      }
      return
    }

    if (!region_memory.observe_index) {
      region_memory.observe_index = 0
    }

    const positions: {x: number, y: number}[] = [
      {x:-1, y:-1},
      {x:+0, y:-1},
      {x:+1, y:-1},
      {x:+1, y:+0},
      {x:+1, y:+1},
      {x:+0, y:+1},
      {x:-1, y:+1},
      {x:-1, y:+0},
    ]

    region_memory.observe_index = (region_memory.observe_index + 1) % positions.length

    const position = positions[region_memory.observe_index]
    const x = Number(this.room.name.slice(1,3)) + position.x
    const y = Number(this.room.name.slice(4,6)) + position.y

    let target_room_name = `W${x}S${y}` // @fixme: WxxNyy
    if (this.room.name == 'E16N37') {
      target_room_name = `E${x}N${y}`
    }

    const result = observer.observeRoom(target_room_name)
    if (result == OK) {
    }
    else {
      console.log(`Region.runObserver 2 failed with ${result}, ${this.name}, observing ${target_room_name}`)
    }
  }

  private sendResources(): void {
    if (CONTROLLER_STRUCTURES[STRUCTURE_TERMINAL][this.controller.level] < 1) {
      return
    }
    if (!this.room.terminal) {
      console.log(`Region.sendResources no terminal ${this.name} ${this.room.terminal}`)
      return
    }
    if (this.room.terminal.cooldown > 0) {
      return
    }

    const region_memory = Memory.regions[this.name]
    if (!region_memory || !region_memory.resource_transports) {
      return
    }

    const raw_resources: ResourceConstant[] = [
      RESOURCE_OXYGEN,
      RESOURCE_HYDROGEN,
      RESOURCE_UTRIUM,
      RESOURCE_LEMERGIUM,
      RESOURCE_ZYNTHIUM,
      RESOURCE_KEANIUM,
      RESOURCE_CATALYST,
    ]

    for (const room_name in region_memory.resource_transports) {
      const resource_types = region_memory.resource_transports[room_name]
      if (!resource_types) {
        continue
      }

      const to_room = Game.rooms[room_name]
      if (!to_room || !to_room.controller || !to_room.controller.my) {
        const message = `Region.sendResources no destination room ${room_name}, ${this.room.name}`
        console.log(message)
        Game.notify(message)
        continue
      }

      if (!to_room.terminal) {
        console.log(`Region.sendResources no terminal in destination room ${room_name}, ${this.room.name}`)
        continue
      }

      for (const resource_type of resource_types) {
        if (RESOURCES_ALL.indexOf(resource_type) < 0) {
          console.log(`Region.sendResources wrong arguments ${resource_type} ${this.name} to ${room_name}`)
          continue
        }

        if (resource_type == RESOURCE_ENERGY) {
          if (!this.room.storage || (this.room.storage.store.energy < this.region_opt.send_to_energy_threshold)) {
            // console.log(`Region.sendResources lack of energy ${this.room.name}`)
            continue
          }
        }

        const capacity = (resource_type == RESOURCE_ENERGY) ? 40000 : 10000

        if (to_room && (!to_room.terminal || ((_.sum(to_room.terminal.store) > (to_room.terminal.storeCapacity - capacity))))) {
          const message = `Terminal ${to_room.name} is full ${this.room.name} ${resource_type}`
          console.log(message)

          if (resource_type != RESOURCE_ENERGY) {
            // Game.notify(message)
          }
          continue  // Could be space for non-energy resources
        }

        if (to_room && (!to_room.storage || ((_.sum(to_room.storage.store) > (to_room.storage.storeCapacity - (capacity * 3)))))) {
          const message = `Storage ${to_room.name} is full ${this.room.name} ${resource_type}`
          console.log(message)

          if (resource_type != RESOURCE_ENERGY) {
            // Game.notify(message)
          }
          continue  // Could be space for non-energy resources
        }

        const is_raw_resource = (raw_resources.indexOf(resource_type) >= 0)
        let amount_needed = is_raw_resource ? 5000 : 1000
        let resource_capacity = 3000
        let amount_send: number = is_raw_resource ? 5000 : Math.min((this.room.terminal.store[resource_type] || 0), 2000)

        if (resource_type == RESOURCE_ENERGY) {
          amount_needed = 70000
          resource_capacity = 200000
          amount_send = 40000
        }

        const from_room_ready: boolean = ((this.room.terminal.store[resource_type] || 0) > amount_needed)
        const to_room_ready: boolean = ((to_room.terminal.store[resource_type] || 0) < resource_capacity)

        if (from_room_ready && to_room_ready) {
          const result = this.room.terminal.send(resource_type, amount_send, room_name)
          console.log(`Send ${resource_type} from ${this.room.name} to ${room_name}, result:${result}`)

          if (result == OK) {
            return
          }
        }
      }
    }
  }

  private sendResourcesTo() {
    // Send ALL resources
    if (!this.room.terminal || (this.room.terminal.cooldown > 0)) {
      return
    }
    const terminal = this.room.terminal

    const region_memory = Memory.regions[this.name]
    if (!region_memory || !region_memory.send_resources_to) {
      return
    }

    const excludes = region_memory.send_resources_to_excludes || []
    let done = false

    region_memory.send_resources_to.forEach((room_name) => {
      if (done) {
        return
      }

      const receiver_room = Game.rooms[room_name]
      if (!receiver_room || !receiver_room.terminal) {
        return
      }

      const capacity = receiver_room.terminal.storeCapacity - _.sum(receiver_room.terminal.store) - 10000

      for (const resource_type of Object.keys(terminal.store)) {
        if (resource_type == RESOURCE_ENERGY) {
          continue
        }
        if (excludes && (excludes.indexOf(resource_type) >= 0)) {
          continue
        }

        const amount = (terminal.store[resource_type as ResourceConstant] || 0)

        if (amount < 100) {
          continue
        }
        if (amount > capacity) {
          continue
        }

        const result = terminal.send(resource_type as ResourceConstant, amount, receiver_room.name)
        if (result == OK) {
          console.log(`${amount} * ${resource_type} sent from ${this.room.name} to ${receiver_room.name}`)

          done = true
          break
        }
      }
    })
  }

  private placeConstructionSite() {
    this.room.place_construction_sites()
  }

  private activateSafeModeIfNeeded() {
    // if (this.room.controller && (this.room.controller.level < 4)) {
    if (this.room.controller) {
      if (this.room.name == 'W49S6') {
        return
      }
      if (this.room.name == 'W46S9') {
        return
      }
    }
    if (this.room.spawns.length == 0) {
      return
    }
    // if (this.room.name != 'W49S34') {
    //   const w49s34 = Game.rooms['W49S34']

    //   if (w49s34 && w49s34.controller && w49s34.controller.my && ((w49s34.controller.safeModeCooldown || 0) < 20000)) {
    //     return
    //   }
    // }

    // Safe mode
    // @todo: this codes should be located on somewhere like Empire
    if (Game.time % 2 == 0) {
      return
    }

    const room = this.room

    if (this.controller.level < 6) {
      return
    }

    const is_safemode_active = (this.controller.safeMode || 0) > 0
    if (is_safemode_active) {
      return
    }

    // If there's no healer, towers and attackers can deal with it
    if (this.room.attacker_info().heal == 0) {
      return
    }
    console.log(`DETECT Healer-Attackers!!! ${room_link(this.room.name)}`)

    const important_structures: StructureConstant[] = [
      STRUCTURE_SPAWN,
      STRUCTURE_STORAGE,
      STRUCTURE_TERMINAL,
      STRUCTURE_LAB,
      STRUCTURE_OBSERVER,
      STRUCTURE_POWER_SPAWN,
      STRUCTURE_NUKER,
      STRUCTURE_EXTENSION,
      STRUCTURE_TOWER,
    ]

    const damaged_structures = room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        return (important_structures.indexOf(structure.structureType) >= 0)
          && (structure.hits < (structure.hitsMax - 100))
      }
    })
    if (damaged_structures.length > 0) {
      const message = `Activate safe mode at ${room.name} : ${this.controller.activateSafeMode()}, damaged structures: ${damaged_structures}`
      console.log(message)
      Game.notify(message)
      return
    }

    const damaged_my_creeps = room.find(FIND_MY_CREEPS, {
      filter: (creep) => {
        return creep.hits < creep.hitsMax
      }
    })

    const number_of_creeps = room.find(FIND_MY_CREEPS).length
    if ((number_of_creeps < 5) && (damaged_my_creeps.length > 1) && (this.worker_squad.creeps.size < 2)) {
      const message = `Activate safe mode at ${room.name} : ${this.controller.activateSafeMode()}, number of creeps: ${number_of_creeps}`
      console.log(message)
      Game.notify(message)
      return
    }
  }

  private transferLinks() {
    if (!this.destination_link_id) {
      if (((Game.time % 43) == 1) && (this.controller.level >= 5)) {
        console.log(`NO destination_link_id in ${this.room.name}`)
      }
      return
    }

    let destination_link = Game.getObjectById(this.destination_link_id) as StructureLink | undefined
    let support_link = this.support_link_ids.map((id) => {
      return Game.getObjectById(id) as StructureLink | undefined
    }).filter((l) => {
      if (!l) {
        const message = `Region.transferLinks incorrect support_link_id ${this.support_link_ids} ${this.name}`
        console.log(message)
        if ((Game.time % 29) == 11) {
          Game.notify(message)
        }
        return false
      }
      if (l.energy > (l.energyCapacity * 0.3)) {
        return false
      }
      return true
    })[0]

    const destination = support_link || destination_link
    if (!destination) {
      console.log(`Region.transferLinks no destination found ${this.name} for ${this.destination_link_id}`)
      return
    }

    if (destination.room.name != this.room.name) {
      const message = `Region.transferLinks the specified link is not in the room ${destination.pos}, ${this.room}`
      console.log(message)
      Game.notify(message)
      return
    }

    let links: StructureLink[] | undefined

    if (this.room.owned_structures) {
      links = this.room.owned_structures.get(STRUCTURE_LINK) as StructureLink[]
    }

    if (!links || (links.length == 0)) {
      this.room.owned_structures_not_found_error(STRUCTURE_LINK)

      links = this.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (structure.structureType == STRUCTURE_LINK)
        }
      }) as StructureLink[]
    }

    if (!links || (links.length == 0)) {
      console.log(`Region.transferLinks no link error ${this.room.name}`)
      return
    }

    const source_links = links.filter((link) => {
      if (link.id == this.destination_link_id) {
        return false
      }
      if (this.support_link_ids.indexOf(link.id) >= 0) {
        return false
      }
      if (link.energy == 0) {
        return false
      }
      if (link.cooldown > 0) {
        return false
      }
      // if ((destination.energyCapacity - destination.energy) > link.energy) {
      //   return true
      // }
      if ((link.energy > (link.energyCapacity / 2))) {
        return true
      }
      return false
    })

    // if (this.room.name == 'W55S23') {
    //   console.log(`HOGE s: ${source_links.map(l=>l.pos)}, d: ${destination.pos}`)
    // }

    let transfer_succeeded = false

    for (const link of source_links) {
      if (link.transferEnergy(destination) == OK) {
        transfer_succeeded = true
        break  // To not consume all link's cooldown time at once
      }
    }

    if (!transfer_succeeded) {
      if (destination_link && support_link && (destination_link.cooldown == 0) && (destination_link.energy > 0) && (support_link.energy < (support_link.energyCapacity * 0.5))) {
        const result = destination_link.transferEnergy(support_link)

        if (result != OK) {
          // console.log(`Region.transferLinks failed ${result} ${this.name}`)
        }
        else {
          // console.log(`Region.transferLinks succeeded ${result} ${this.name}`)
        }
      }
    }
  }

  private spawnAndRenew(): void {
    const no_remote_harvester = this.room.controller && (this.room.controller.level < 6)

    const availableEnergy = this.room.energyAvailable
    const energy_capacity = this.room.energyCapacityAvailable - 50

    let squad_needs_spawn = this.delegated_squads.concat(this.squads_need_spawn)
    squad_needs_spawn = squad_needs_spawn.filter((squad) => {
      if (no_remote_harvester && ([SquadType.REMOET_HARVESTER].indexOf(squad.type) >= 0) && (squad as RemoteHarvesterSquad).is_keeper_room) {
        return false
      }
      return (squad.hasEnoughEnergy(availableEnergy, energy_capacity))
    })

    const urgent = (squad_needs_spawn.length > 0) ? squad_needs_spawn[0].spawnPriority == SpawnPriority.URGENT : false

    Array.from(this.spawns.values()).filter((spawn) => {
      if (spawn.spawning) {
        return false
      }
      if (urgent) {
        return true
      }
      return spawn.renewSurroundingCreeps() == ActionResult.DONE
    }).forEach((spawn) => {
      const squad = squad_needs_spawn.pop()

      if (squad) {
        squad.addCreep(availableEnergy, (body, name, ops) => { // this closure is to keep 'this'
          const result = spawn.spawnCreep(body, name, ops)
          if (result == OK) {
            Memory.regions[this.name].last_spawn_time = Game.time
          }
          else {
            // @fixme: If
            const message = `${spawn.name} in ${this.name} assign to ${squad.name}: ${result}, energy: ${this.room.energyAvailable}, (length: ${body.length}) [${body}]`
            console.log(message)
            Game.notify(message)
          }
          return result
        })
      }
    })
  }

  private watchDog(): void {
    const region_memory = Memory.regions[this.name]
    let error: string | undefined

    if (!region_memory) {
      error = `No region_memory`
    }
    else {
      if (this.room.name == 'W49S6') {
        return
      }
      if (this.room.name == 'W46S9') {
        return
      }
      if (!this.room.controller || (this.room.controller.level < 5)) {
        return
      }

      let duration = 600
      if ((this.controller.level < 7)) {
        duration = 700
      }

      if (this.room.name == 'W51S29') {
        duration = 770
      }

      if (!region_memory.last_spawn_time) {
        error = `No last_spawn_time`
      }
      else if ((Game.time - region_memory.last_spawn_time) > duration) {
        error = `No spawn in ${(Game.time - region_memory.last_spawn_time)} ticks (last_spawn_time: ${region_memory.last_spawn_time})`
      }
    }

    if (!error) {
      return
    }

    const message = `[ERROR] Region ${this.name} ${error}`
    console.log(message)

    const excludes: string[] = []
    if (excludes.indexOf(this.room.name) < 0) {
      Game.notify(message)
    }
  }

  private create_squad_memory(): void {

    const new_squads: {[name: string]: SquadMemory} = {}

    // --- Upgrader ---
    const upgrader_name = `upgrader_${this.room.name.toLowerCase()}` //UpgraderSquad.generateNewName()
    const upgrader_memory: SquadMemory = {
      name: upgrader_name,
      type: SquadType.UPGRADER,
      owner_name: this.name,
      number_of_creeps: 0,
    }
    new_squads[upgrader_name] = upgrader_memory


    // --- Charger ---
    const charger_name = `charger_${this.room.name.toLowerCase()}`
    const charger_memory: SquadMemory = {
      name: charger_name,
      type: SquadType.CHARGER,
      owner_name: this.name,
      number_of_creeps: 0,
    }
    new_squads[charger_name] = charger_memory


    // --- Scout ---
    const scout_name = `scout_${this.room.name.toLowerCase()}` //ScoutSquad.generateNewName()
    const scout_memory: SquadMemory = {
      name: scout_name,
      type: SquadType.SCOUT,
      owner_name: this.name,
      number_of_creeps: 0,
    }
    new_squads[scout_name] = scout_memory


    // --- Researcher ---
    const researcher_name = `researcher_${this.room.name.toLowerCase()}` //ResearcherSquad.generateNewName()
    const researcher_memory: SquadMemory = {
      name: researcher_name,
      type: SquadType.RESEARCHER,
      owner_name: this.name,
      number_of_creeps: 0,
    }
    new_squads[researcher_name] = researcher_memory


    // --- Attacker ---
    const attacker_name = `attacker_${this.room.name.toLowerCase()}` //AttackerSquad.generateNewName()
    const attacker_memory: SquadMemory = {
      name: attacker_name,
      type: SquadType.ATTACKER,
      owner_name: this.name,
      number_of_creeps: 0,
    }
    new_squads[attacker_name] = attacker_memory


    // --- Manual ---
    const manual_name = `manual_${this.room.name.toLowerCase()}`
    const manual_memory: SquadMemory = {
      name: manual_name,
      type: SquadType.MANUAL,
      owner_name: this.name,
      number_of_creeps: 0,
    }
    new_squads[manual_name] = manual_memory


    // --- Temp ---
    const temp_name = `temp_${this.room.name.toLowerCase()}`
    const temp_memory: SquadMemory = {
      name: temp_name,
      type: SquadType.TEMP,
      owner_name: this.name,
      number_of_creeps: 0,
    }
    new_squads[temp_name] = temp_memory


    // no longer needed
    // // --- Nuker Charger ---
    // const nuker_charger_name = `nuker_charger_${this.room.name.toLowerCase()}`
    // const nuker_charger_memory: NukerChargerSquadMemory = {
    //   name: nuker_charger_name,
    //   type: SquadType.NUKER_CHARGER_SQUAD,
    //   owner_name: this.name,
    //   number_of_creeps: 0,
    //   nuker_id: undefined,
    // }
    // new_squads[nuker_charger_name] = nuker_charger_memory

    for (const squad_name in new_squads) {
      if (Memory.squads[squad_name]) {
        console.log(`${this.name}, ${squad_name} already exsists`)
        continue
      }

      const squad_memory = new_squads[squad_name]
      Memory.squads[squad_name] = squad_memory

      console.log(`${this.name}, creates ${squad_name}`)
    }
  }

  private drawDebugInfo(): void { // @todo: Show debug info for each rooms
    const show_visuals = Memory.debug.show_visuals
    if (!show_visuals || (show_visuals != this.room.name)) {
      return
    }

    const region_memory = Memory.regions[this.name] as RegionMemory
    const room_memory = Memory.rooms[this.room.name]

    const ancestor = region_memory.ancestor || 'unknown'
    let pos: {x: number, y: number} = {x: 1, y: 1}

    switch(this.room.name) {

      case 'W44S7':
        pos = {x: 25, y: 1}
        break

      case 'W43S5':
        pos = {x: 25, y: 25}
        break

      default:
        break
    }

    if (room_memory && room_memory.description_position) {
      pos = room_memory.description_position
    }

    let lines: string[] = [
      `${this.name} in ${this.room.name}: ${ancestor}`,
      `  Capacity: ${this.room.energyCapacityAvailable}, Reaction: ${region_memory.reaction_outputs}`,
      `  Squads: ${this.squads.size}, Creeps: ${_.sum(Array.from(this.squads.values()).map(s=>s.creeps.size))}`,
    ]

    const squad_descriptions = this.squadDescriptions(Array.from(this.squads.values()))
    lines = lines.concat(squad_descriptions)

    lines.push(`  - not instantiated:`)
    lines = lines.concat(this.no_instantiations)

    if (this.delegated_squads.length > 0) {
      lines.push(`  Delegated: `)
      const delegated_descriptions = this.squadDescriptions(this.delegated_squads)
      lines = lines.concat(delegated_descriptions)
    }

    this.room.visual.multipleLinedText(lines, pos.x, pos.y, {
      align: 'left',
      opacity: 0.8,
      font: '12px',
    })
  }

  private squadDescriptions(squads: Squad[]): string[] {
    return squads.sort((lhs, rhs) => {
      return (lhs.name > rhs.name) ? 1 : -1
    }).map((squad) => {
      return `  - ${squad.description()}`
    }).join('\n').split('\n')
  }
}
