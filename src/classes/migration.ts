enum MigrationResult {
  DONE      = 'done',
  FAILED    = 'failed',
}

export function migrate(name: string):void {
  if (!name || !migrations[name]) {
    console.log(`Migration.migrate missing name "${name}"`)
    return
  }

  let index: number | undefined

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
  }

  const result = migrations[name]()

  Memory.migrations.list.push({
    name,
    status: result,
  })

  console.log(`Result:\n${list().map(s=> s + '\n')}`)
}

export function list(): string[] {
  const results: string[] = []

  for (const migration of Memory.migrations.list) {
    results.push(`- [${migration.status}]:\t ${migration.name}`)
  }

  return results.reverse()
}

const migrations: {[name: string]: () => MigrationResult} = {
  add_status_to_region_memory,
}

function add_status_to_region_memory(): MigrationResult {
  console.log(`Migration.add_status_to_region_memory`)

  return MigrationResult.FAILED
}
