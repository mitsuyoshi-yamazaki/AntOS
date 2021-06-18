import { leveled_colored_text, ColorLevel, room_link } from "../linted/utility";
import { RegionStatus } from "./region";


export enum MigrationResult {
  PREPARED  = 'prepared',
  DONE      = 'done',
  FAILED    = 'failed',
}

export function migrate(name: string, opts?:{dry_run?: boolean}): MigrationResult {
  opts = opts || {}
  const dry_run = !(opts.dry_run == false)

  if (!name || !migrations[name]) {
    console.log(`\nMigration.migrate missing name "${name}"`)
    return MigrationResult.FAILED
  }

  let index: number | undefined
  let status: string = 'run'

  for (const i in Memory.migrations.list) {
    const migration = Memory.migrations.list[i]

    if (migration.name != name) {
      continue
    }

    index = Number(i)
    break
  }

  if (index != undefined) {
    Memory.migrations.list.splice(index, 1)
    status = 'rerun'
  }

  const boundary = leveled_colored_text('----------', 'warn')
  const dry_run_desc = dry_run ? `(${leveled_colored_text('DRY_RUN', 'critical')})` : ''

  console.log(`\nMigration ${dry_run_desc} ${status} ${name}\n\n${boundary}`)
  const result = migrations[name](opts)

  Memory.migrations.list.push({
    name,
    status: result,
  })

  const color_level: ColorLevel = (result == MigrationResult.DONE) ? 'almost' : 'critical'
  console.log(`\n\n${boundary}\nMigration ${name} ${leveled_colored_text(result, color_level)}`)

  console.log(`\nList:${list().map(s=> '\n' + s)}\n`)

  return result
}

export function list(): string[] {
  const results: string[] = []

  for (const migration of Memory.migrations.list) {
    results.push(`- [${migration.status}]:\t ${migration.name}`)
  }

  return results.reverse()
}

// ---- Migrations
const migrations: {[name: string]: (opts?:{dry_run?: boolean}) => MigrationResult} = {
  remove_unused_region_memory,
  add_status_to_region_memory,
}

function remove_unused_region_memory(opts?:{dry_run?: boolean}): MigrationResult {
  opts = opts || {}
  const dry_run = !(opts.dry_run == false)

  let number_of_regions = 0
  let number_of_missing_regions = 0

  for (const region_name of Object.keys(Memory.regions)) {
    const room = Game.rooms[region_name]
    if (room) {
      if (room.controller && room.controller.my) {
        console.log(`- [${room_link(region_name)}]:\t${leveled_colored_text('ok', 'info')}`)
        number_of_regions += 1
        continue
      }
      else {
        // has room but no controller
        console.log(`- [${room_link(region_name)}]:\t${leveled_colored_text('not owned', 'error')}`)
      }
    }
    else {
      // room not visible
      console.log(`- [${room_link(region_name)}]:\t${leveled_colored_text('room not visible', 'error')}`)
    }

    number_of_missing_regions += 1
    if (!dry_run) {
      delete Memory.regions[region_name]
    }
  }

  console.log(`\nAvailable region: ${number_of_regions},\tUnavailable regions: ${number_of_missing_regions}`)

  if (dry_run) {
    return MigrationResult.PREPARED
  }
  return MigrationResult.DONE
}

function add_status_to_region_memory(opts?:{dry_run?: boolean}): MigrationResult {
  opts = opts || {}
  const dry_run = !(opts.dry_run == false)

  for (const region_name of Object.keys(Memory.regions)) {
    const region_memory = Memory.regions[region_name]

    const room = Game.rooms[region_name]
    if (!room) {
      console.log(`- [${region_name}]:\t${leveled_colored_text('room not found', 'error')}`)
      continue
    }

    if (!room.controller || !room.controller.my) {
      console.log(`- [${region_name}]:\t${leveled_colored_text('room not owned', 'error')}`)
      continue
    }

    if (region_memory.status == undefined) {
      if (!dry_run) {
        region_memory.status = RegionStatus.NORMAL
      }
      console.log(`- [${region_name}]:\t${leveled_colored_text('set "normal" status', 'info')}`)
      continue
    }
    console.log(`- [${region_name}]:\t${leveled_colored_text('nothing to do', 'info')} (${region_memory.status})`)
  }

  if (dry_run) {
    return MigrationResult.PREPARED
  }
  return MigrationResult.DONE
}
