import { leveled_colored_text, ColorLevel } from "./utils";


export enum MigrationResult {
  DONE      = 'done',
  FAILED    = 'failed',
}

export function migrate(name: string): MigrationResult {
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

  console.log(`Migration ${status} ${name}`)
  const result = migrations[name]()

  Memory.migrations.list.push({
    name,
    status: result,
  })

  const color_level: ColorLevel = (result == MigrationResult.DONE) ? 'almost' : 'critical'
  console.log(`Migration ${name} ${leveled_colored_text(result, color_level)}`)

  console.log(`List:\n${list().map(s=> s + '\n')}`)

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
const migrations: {[name: string]: () => MigrationResult} = {
  add_status_to_region_memory,
}

function add_status_to_region_memory(): MigrationResult {

  // for (const region_name of Object.keys(Memory.regions)) {
  //   const region_memory = Memory.regions[region_name]


  // }

  return MigrationResult.FAILED
}
