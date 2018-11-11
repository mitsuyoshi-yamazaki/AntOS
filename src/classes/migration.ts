export function migrate(name: string) {
  if (!name || !migrations[name]) {
    console.log(`Migration.migrate missing name "${name}"`)
    return
  }

  migrations[name]()
}

const migrations: {[name: string]: () => void} = {
  add_status_to_region_memory,
}

function add_status_to_region_memory(): void {
  console.log(`Migration.add_status_to_region_memory`)
}
