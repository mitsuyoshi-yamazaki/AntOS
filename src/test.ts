import { CreepStatus } from "extensions";

let values: number[][] = []

export function test(): void {
  const room = Game.rooms['W2N4']
  if (!room) {
    console.log(`ERROR no room`)
    return
  }

  const spawn = room.find(FIND_MY_SPAWNS)[0]
  if (!spawn) {
    console.log(`ERROR no spawn`)
    return
  }

  calculate(room)
  spawnCreep(spawn)
  runCreeps(room, spawn)
}

function calculate(room: Room): void {
  console.log(`values.len: ${values.length}`)
  values = []

  const sources = room.find(FIND_SOURCES)

  const size = 50
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

function spawnCreep(spawn: StructureSpawn): void {

  const name = `Creep${Game.time}`
  const body: BodyPartConstant[] = [
    CARRY, WORK, MOVE
  ]
  const opt = {}

  spawn.spawnCreep(body, name, opt)
}

function runCreeps(room: Room, spawn: StructureSpawn): void {
  for (const creepName in Game.creeps) {
    const creep = Game.creeps[creepName]

    if (creep.memory.debug) {
      creep.say(`${creep.memory.status}`)
    }

    if ([CreepStatus.HARVEST, CreepStatus.CHARGE].indexOf(creep.memory.status) < 0) {
      creep.memory.status = CreepStatus.HARVEST
    }
    if (creep.carry.energy == 0) {
      creep.memory.status = CreepStatus.HARVEST
    }
    else if (creep.carry.energy == creep.carryCapacity) {
      creep.memory.status = CreepStatus.CHARGE
    }

    if (creep.memory.status == CreepStatus.HARVEST) {
      const x = creep.pos.x
      const y = creep.pos.y
      const surrounded: {x:number, y:number, value:number, direction:DirectionConstant}[] = [
        {
          x: x-1,
          y: y-1,
          direction: TOP_LEFT,
        },
        {
          x: x-1,
          y: y,
          direction: LEFT,
        },
        {
          x: x-1,
          y: y+1,
          direction: BOTTOM_LEFT,
        },
        {
          x: x,
          y: y-1,
          direction: TOP,
        },
        {
          x: x,
          y: y+1,
          direction: BOTTOM,
        },
        {
          x: x+1,
          y: y-1,
          direction: TOP_RIGHT,
        },
        {
          x: x+1,
          y: y,
          direction: RIGHT,
        },
        {
          x: x+1,
          y: y+1,
          direction: BOTTOM_RIGHT,
        },
      ].map((p) => {
        return {
          x: p.x,
          y: p.y,
          value: values[p.x][p.y],
          direction: p.direction,
        }
      }).filter((p) => {
        return p.value != null
      }).sort((lhs, rhs) => {
        if (lhs.value < rhs.value) return 1
        if (lhs.value > rhs.value) return -1
        return 0
      })

      if (surrounded[0]) {
        const move_result = creep.move(surrounded[0].direction)

        if (move_result != OK) {
          creep.say(`E${move_result}`)
        }
      }
      else {
        creep.say(`NO MOV`)
      }
    }

    if (creep.memory.status == CreepStatus.CHARGE) {
      if (creep.transfer(spawn, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
        creep.moveTo(spawn)
      }
    }
  }
}
