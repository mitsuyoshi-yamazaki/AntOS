export function test(): void {
  const room = Game.rooms['W2N4']
  if (!room) {
    console.log(`ERROR no room`)
    return
  }

  const sources = room.find(FIND_SOURCES)

  const size = 50
  const values: number[][] = []
  const attenuation_rate = Memory.parameters.attenuation

  for (let x = 0; x < size; x++) {
    values.push([])

    for (let y = 0; y < size; y++) {
      values[x].push(0)
    }
  }

  // console.log(`${values}`)

  sources.forEach((source) => {
    values[source.pos.x][source.pos.y] = source.energy
    const value_cache: {[index: number]: number} = {}

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const i = source.pos.x - x
        const j = source.pos.y - y

        const range = Math.max(Math.abs(i), Math.abs(j))
        const cached_value = value_cache[range]

        if (cached_value) {
          values[x][y] += cached_value
        }
        else {
          let value = source.energy
          let r = range

          while((r > 0) && (value > 1)) {
            value = Math.ceil(value / attenuation_rate)
            r--
          }

          values[x][y] += value
          value_cache[range] = value
        }
      }
    }
  });

  if (Memory.debug.show_visual) {
    values.forEach((row, x) => {
      row.forEach((value, y) => {
        const pos = new RoomPosition(x, y, room.name)

        room.visual.text(`${value}`, pos, {
          color: '#ffffff',
          align: 'center',
          font: '12px',
          opacity: 0.8,
        })
      })
    })
  }
}
