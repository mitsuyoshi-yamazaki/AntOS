import { leveled_colored_text, ColorLevel } from "./utils";
import { RegionStatus } from "./region";


export enum MigrationResult {
  DONE      = 'done',
  FAILED    = 'failed',
}

export function migrate(name: string, opts?:{dry_run?: boolean}): MigrationResult {
  opts = opts || {}
  const dry_run = !(opts.dry_run == false)

  if (!name || !migrations[name]) {
    console.log(`Migration.migrate missing name "${name}"`)
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

  console.log(`Migration ${dry_run_desc} ${status} ${name}\n\n${boundary}`)
  const result = migrations[name](opts)

  Memory.migrations.list.push({
    name,
    status: result,
  })

  const color_level: ColorLevel = (result == MigrationResult.DONE) ? 'almost' : 'critical'
  console.log(`\n\n${boundary}\nMigration ${name} ${leveled_colored_text(result, color_level)}`)

  console.log(`\nList:\n${list().map(s=> s + '\n')}`)

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

  for (const region_name of Object.keys(Memory.regions)) {
    const region_memory = Memory.regions[region_name]

  }

  return MigrationResult.FAILED
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

  return MigrationResult.DONE
}
