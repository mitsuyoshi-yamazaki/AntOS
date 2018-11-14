
import { ErrorMapper } from "utils/ErrorMapper"
import { Region, RegionOpt } from "./region"
import { Squad, SpawnPriority, SquadType } from "./squad/squad";
import { getSectorName } from "./utils";

enum State {
  EXPAND = "expand"
}

interface OnboardingInfo {
  target_room_name: string
  base_room_name: string
  forced: boolean
  delegate_until: number
  layout: {name: string, pos: {x: number, y: number}}
  step_rooms: {
    // @todo:
  }[]
}

export interface EmpireMemory {
  farm: {
    room: string | null
    energy_room: string | null
    boost_compound: string
  } | null
  next_rooms: OnboardingInfo[]
  onboarding_rooms: {[base_room_name: string]: OnboardingInfo}
  whitelist: {
    use: boolean
    additional_players: string[]
  }
  war: {
    swarm: {
      targets: {[target_room_name: string]: {
        base_room: string
        waypoint: {
          room_name: string
          x: number
          y: number
        }
      }}
    }
  }
}

export class Empire {
  private regions = new Map<string, Region>()

  constructor(readonly name: string) {
    if (!Memory.empires[this.name]) {
      Memory.empires[this.name] = {
        farm: null,
        next_rooms: [],
        onboarding_rooms: {},
        whitelist: {
          use: false ,
          additional_players: [],
        },
        war: {
          swarm: {
            targets: {},
          }
        },
      }
    }
    const empire_memory = Memory.empires[this.name]

    // --- Owned Rooms
    const owned_controllers: StructureController[] = []
    const owned_room_names: string[] = []

    for (const room_name in Game.rooms) {
      const room = Game.rooms[room_name]
      if (!room || !room.controller || !room.controller.my) {
        continue
      }

      if (room.memory && room.memory.is_gcl_farm) {
        continue
      }

      owned_room_names.push(room.name)
      owned_controllers.push(room.controller)
    }

    if ((Game.time % 107) == 3) {
      owned_room_names.forEach(room_name => {
        const sector_name = getSectorName(room_name)
        if (!sector_name) {
          return
        }

        if (!Memory.sectors[sector_name]) {
          Memory.sectors[sector_name] = {
            name: sector_name,
            regions: [],
          }
        }

        const sector_memory = Memory.sectors[sector_name]
        if (sector_memory.regions.indexOf(room_name) < 0) {
          sector_memory.regions.push(room_name)
        }
      })
    }

    // --- Attack
    const attacker_room_names: string[] = [
    ]
    const attack_to: string | null = null

    // --- Claim
    const number_of_gcl_farms = 1
    const non_owned_onboarding_rooms = Object.keys(empire_memory.onboarding_rooms).filter(room_name=> {
      const info = empire_memory.onboarding_rooms[room_name]
      return owned_room_names.indexOf(info.target_room_name) < 0
    })

    let number_of_claimable_rooms = Math.max(Game.gcl.level - number_of_gcl_farms - non_owned_onboarding_rooms.length - owned_controllers.length, 0)

    if ((Game.time % 29) == 1) {
      console.log(`number_of_claimable_rooms: ${number_of_claimable_rooms}`)
    }

    for (const next_room of empire_memory.next_rooms) {
      if (number_of_claimable_rooms <= 0) {
        break
      }

      const index = empire_memory.next_rooms.indexOf(next_room)

      if (index >= 0) {
        // @todo: debug here
        empire_memory.onboarding_rooms[next_room.base_room_name] = next_room
        console.log(`Empire set next room: ${next_room.base_room_name}`)

        empire_memory.next_rooms.splice(index, 0)
        number_of_claimable_rooms -= 1
        break
      }
    }

    // --- GCL Farms
    const gcl_farm_rooms: {[room_name: string]: {next: string, base: string}} = {
      W49S6: {next: 'W46S9', base: 'W48S6'},
      W46S9: {next: 'W47S8', base: 'W47S9'},
      W47S8: {next: 'W49S6', base: 'W47S9'},
    }

    let farm_room: {room: Room, controller: StructureController, next: string, base: string} | null = null
    let next_farm: {target_room_name: string, base_room_name: string} | null = null
    const send_to_energy_threshold = 200000

    for (const room_name in gcl_farm_rooms) {
      const room = Game.rooms[room_name]
      if (!room || !room.controller || !room.controller.my) {
        continue
      }
      farm_room = {
        room,
        controller: room.controller,
        ...gcl_farm_rooms[room_name]
      }
      break
    }

    if (farm_room) {
      if (!empire_memory.farm) {
        empire_memory.farm = {
          room: null,
          energy_room: null,
          boost_compound: RESOURCE_CATALYZED_GHODIUM_ACID,
        }
      }
      if (empire_memory.farm.room != farm_room.room.name) {
        const xgh2o_amount = Game.check_resource_amount(RESOURCE_CATALYZED_GHODIUM_ACID)

        if (xgh2o_amount >= 30000) {
          empire_memory.farm.boost_compound = RESOURCE_CATALYZED_GHODIUM_ACID
        }
        else {
          empire_memory.farm.boost_compound = RESOURCE_GHODIUM_ACID
        }

        const boost_compound_message = `Reset farm boost compound to ${empire_memory.farm.boost_compound} (${xgh2o_amount} XGH2O)`
        console.log(boost_compound_message)
        Game.notify(boost_compound_message)
      }

      empire_memory.farm.room = farm_room.room.name

      const default_compound = RESOURCE_CATALYZED_GHODIUM_ACID
      const valid_compounds: string[] = [RESOURCE_CATALYZED_GHODIUM_ACID, RESOURCE_GHODIUM_ACID]
      const is_valid_compound = valid_compounds.indexOf(empire_memory.farm.boost_compound) >= 0

      const boost_resource = is_valid_compound ? (empire_memory.farm.boost_compound as ResourceConstant) : default_compound

      if (!is_valid_compound) {
        console.log(`EmpireMemory.farm.boost_compound is not valid boost compound ${empire_memory.farm.boost_compound}, ${this.name}`)
        empire_memory.farm.boost_compound = default_compound
      }

      switch (farm_room.controller.level) {
        case 1: {
          this.transfer_farm_energy(farm_room.base)
          break
        }

        case 6: {
          if (farm_room.room.terminal) {
            this.transfer_farm_energy(farm_room.room.name, {with_boosts: true, boost_resource})
          }
          break
        }

        case 7: {
          const remaining = farm_room.controller.progressTotal - farm_room.controller.progress
          if (remaining < 30000) {
            next_farm = {
              target_room_name: farm_room.next,
              base_room_name: farm_room.base,
            }
          }
          break
        }

        case 8: {
          this.transfer_farm_energy(farm_room.room.name, {stop: true, with_boosts: true, boost_resource})
          let avoid_unclaim = false
          const boost_amount = (farm_room.controller.my && farm_room.room.terminal) ? (farm_room.room.terminal.store[boost_resource] || 0) : 0

          if (farm_room.room.terminal && (boost_amount >= 100)) {
            const base_room = Game.rooms[farm_room.base]
            const energy_needed = boost_amount + 2000

            if ((farm_room.room.terminal.store.energy < energy_needed) && base_room && base_room.terminal && (base_room.terminal.store.energy >= energy_needed)) {
              const transfer_result = base_room.terminal.send(RESOURCE_ENERGY, energy_needed, farm_room.room.name)
              avoid_unclaim = ([OK, ERR_TIRED] as ScreepsReturnCode[]).indexOf(transfer_result) >= 0

              const message = `Transfer ${RESOURCE_ENERGY} * ${energy_needed} from ${base_room.name} to ${farm_room.room.name}: ${transfer_result}`
              console.log(message)
              Game.notify(message)
            }
            else {
              const transfer_result = farm_room.room.terminal.send(boost_resource, boost_amount, farm_room.base)
              avoid_unclaim = transfer_result == OK

              const message = `Transfer ${boost_resource} * ${boost_amount} from ${farm_room.room.name} to ${farm_room.base}: ${transfer_result}`
              console.log(message)
              Game.notify(message)
            }
          }

          if (!avoid_unclaim && (['W49S6', 'W46S9', 'W47S8'].indexOf(farm_room.room.name) >= 0)) {
            farm_room.controller.unclaim()
            const message = `Unclaim farm ${farm_room}`
            console.log(message)
            Game.notify(message)
          }
          else {
            const message = `You're about to unclaim ${farm_room.room.name}!`
            console.log(message)
            Game.notify(message)
          }

          next_farm = {
            target_room_name: farm_room.next,
            base_room_name: farm_room.base,
          }
          break
        }

        default:
          break
      }
    }
    else {
      if (empire_memory && empire_memory.farm && empire_memory.farm.room) {
        const farm_info = gcl_farm_rooms[empire_memory.farm.room]
        const next_farm_info = gcl_farm_rooms[farm_info.next]

        next_farm = {
          target_room_name: farm_info.next,
          base_room_name: next_farm_info.base,
        }
      }
    }

    // ---
    const test_send_resources = Memory.debug.test_send_resources
    const should_send_resources = test_send_resources || ((Game.time % 67) == 1)

    if (should_send_resources) {
      console.log(`Send resource at ${Game.time}`)
    }

    // --- Regions
    for (const controller of owned_controllers) {
      const room = controller.room

      const opt: RegionOpt = {
        produce_attacker: (attacker_room_names.indexOf(room.name) >= 0),
        attack_to,
        send_to_energy_threshold,
        should_send_resources,
      }

      if (next_farm && (next_farm.base_room_name == room.name)) {
        opt.temp_squad_opt = {
          target_room_name: next_farm.target_room_name,
          forced: false,
        }
      }
      else if (empire_memory.onboarding_rooms[room.name]) {
        opt.temp_squad_opt = empire_memory.onboarding_rooms[room.name]
      }

      ErrorMapper.wrapLoop(() => {
        const region = new Region(controller, opt)
        this.regions.set(region.name, region)
      }, `${room.name}.init`)()
    }

    for (const room_name in empire_memory.onboarding_rooms) {
      const info = empire_memory.onboarding_rooms[room_name]

      this.setDelegate(room_name, info.target_room_name, {max_rcl: info.delegate_until})
    }
  }

  public say(message: string): void {
    this.regions.forEach((region) => {
      region.say(message)
    })
  }

  public run(): void {
    this.regions.forEach((region) => {
      ErrorMapper.wrapLoop(() => {
        region.run()
      }, `${region.name}.run`)()
    })

    if ((Game.time % 347) == 5) {
      ErrorMapper.wrapLoop(() => {
        Game.balance_storage({dry_run: false, no_logs: true})
      }, `${this.name} balancing storage`)()
    }
  }

  // --- Private
  private transfer_farm_energy(room_name: string, opts?: {stop?: boolean, with_boosts?: boolean, boost_resource?: ResourceConstant}): void {
    opts = opts || {}

    const empire_memory = Memory.empires[this.name]
    if (!empire_memory || !empire_memory.farm) {
      console.log(`Empire.transfer_farm_energy ${room_name} no empire memory for ${this.name}, ${empire_memory}`)
      return
    }

    const resource_type = opts.boost_resource || RESOURCE_CATALYZED_GHODIUM_ACID
    const notify = false

    if (opts.stop) {
      if (empire_memory.farm.energy_room && (empire_memory.farm.energy_room == room_name)) {
        Game.transfer_energy(room_name, {stop: true, notify})
        empire_memory.farm.energy_room = null

        if (opts.with_boosts) {
          Game.transfer_resource(resource_type, room_name, {stop: true, notify})
        }
      }
    }
    else {
      if (empire_memory.farm.energy_room && (empire_memory.farm.energy_room != room_name)) {
        Game.transfer_energy(empire_memory.farm.energy_room, {stop: true, notify})
        empire_memory.farm.energy_room = null
      }

      if (!empire_memory.farm.energy_room || (empire_memory.farm.energy_room != room_name)) {
        Game.transfer_energy(room_name, {notify})
        empire_memory.farm.energy_room = room_name

        if (opts.with_boosts) {
          Game.transfer_resource(resource_type, room_name, {notify})
        }
      }
    }
  }

  private setDelegate(base_region_name: string, colony_region_name: string, opts?: {excludes?: SquadType[], max_rcl?: number}): void {
    ErrorMapper.wrapLoop(() => {
      opts = opts || {}

      const base_region = this.regions.get(base_region_name)
      const colony_region = this.regions.get(colony_region_name)

      if (!base_region || !colony_region || !colony_region.controller.my) {
        if ((Game.time % 29) == 13) {
          const message = `Empire.set_delegate ERROR ${base_region_name} or ${colony_region_name} not found`
          console.log(message)
          // Game.notify(message)
        }
        return
      }

      if (opts.max_rcl && (colony_region.controller.level > opts.max_rcl)) {
        return
      }

      const includes_opt = [
        SquadType.REMOET_HARVESTER,
        SquadType.REMOET_M_HARVESTER,
      ]

      let excludes_opt: SquadType[]
      if (opts.excludes) {
        excludes_opt = opts.excludes
      }
      else if (colony_region.room.spawns.length > 0) {
        excludes_opt = [
          SquadType.ATTACKER,
          SquadType.SCOUT,
          SquadType.TEMP,
          SquadType.CHARGER,
        ]

        if ((colony_region.controller.level >= 3) && (colony_region.room.energyCapacityAvailable >= 600)) {
          excludes_opt.push(SquadType.HARVESTER)
        }
        if ((colony_region.controller.level >= 4) && (colony_region.room.energyCapacityAvailable >= 1800)) {
          excludes_opt.push(SquadType.WORKER)
          excludes_opt.push(SquadType.MANUAL)
          excludes_opt.push(SquadType.RESEARCHER)
          excludes_opt.push(SquadType.UPGRADER)
        }
      }
      else {
        excludes_opt = []
      }

      if ((colony_region.controller.level <= 5)) {
        const squads: Squad[] = colony_region.squads_need_spawn.filter((squad) => {
          return excludes_opt.indexOf(squad.type) < 0
        })

        base_region.delegated_squads = squads
      }
      else if ((colony_region.controller.level <= 6)) {
        const squads: Squad[] = colony_region.squads_need_spawn.filter((squad) => {
          return includes_opt.indexOf(squad.type) >= 0
        })

        base_region.delegated_squads = squads
      }
    }, `${base_region_name}.set_delegate`)()
  }
}
