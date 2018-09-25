import { color_2_hex } from './utils';

/**
 * https://screeps.com/a/#!/room/shard2/W11S52
 * https://screeps.com/a/#!/room/shard1/E22N32
 */

type STRUCTURE_SPARE= 'spare'
type StructureConstantForRoomLayout = StructureConstant | STRUCTURE_SPARE

type LayoutMarkCenter    = '0'
const LAYOUT_MARK_CENTER = '0'

type LayoutMarkBlank     = '.'
const LAYOUT_MARK_BLANK  = '.'

type LayoutMarkSpare     = '*'
const LAYOUT_MARK_SPARE  = '*'

type LayoutMarkRoad      = '-'
const LAYOUT_MARK_ROAD   = '-'

type LayoutMarkStorage   = 's'
const LAYOUT_MARK_STORAGE = 's'

type LayoutMarkTerminal  = 't'
const LAYOUT_MARK_TERMINAL = 't'

type LayoutMarkLink      = 'i'
const LAYOUT_MARK_LINK   = 'i'

type LayoutMarkLab       = 'l'
const LAYOUT_MARK_LAB    = 'l'

type LayoutMarkContainer = 'c'
const LAYOUT_MARK_CONATINER = 'c'

type LayoutMarkTower     = 'o'
const LAYOUT_MARK_TOWER  = 'o'

type LayoutMarkSpawn     = '6'
const LAYOUT_MARK_SPAWN  = '6'

type LayoutMarkNuker     = 'n'
const LAYOUT_MARK_NUKER  = 'n'

type LayoutMarkExtension     = 'x'
const LAYOUT_MARK_EXTENSION  = 'x'

type StructureMark = LayoutMarkStorage
  | LayoutMarkTerminal
  | LayoutMarkLink
  | LayoutMarkLab
  | LayoutMarkContainer
  | LayoutMarkTower
  | LayoutMarkSpawn
  | LayoutMarkNuker
  | LayoutMarkExtension

type LayoutMark = StructureMark
  | LayoutMarkBlank
  | LayoutMarkCenter
  | LayoutMarkSpare
  | LayoutMarkRoad

interface RoomLayoutAttributes {
}

const layouts: {[name: string]: {layout: LayoutMark[][], attributes: RoomLayoutAttributes}} = {
  mark01: {
    layout: [
      ['.', '.', '-', '-', '-', '-', '-', '-', 'x', 'x', '-', '-', '.'],
      ['.', '-', 'l', 'l', 'l', '-', 'x', 'x', '-', '-', 'x', 'x', '-'],
      ['-', 'l', '-', 'l', 'l', '-', 'x', '-', 'x', 'x', '-', 'x', '-'],
      ['-', 'l', 'l', '-', '-', 'o', '-', 'x', 'x', 'x', 'x', '-', 'x'],
      ['-', 'l', 'l', '-', 't', '-', '6', '-', 'o', 'x', 'x', '-', 'x'],
      ['-', '-', '-', 'o', '-', '.', 'i', '.', '-', 'x', '-', 'x', '-'],
      ['-', 'x', 'x', '-', '6', 'n', 's', '-', '6', '-', 'x', 'x', '-'], // center
      ['-', 'x', '-', 'x', '-', '-', 'o', '.', '-', 'x', '-', 'x', '-'],
      ['x', '-', 'x', 'x', 'o', '-', '6', '-', 'x', 'x', 'x', '-', 'x'],
      ['x', '-', 'x', 'x', 'x', 'x', '-', 'x', 'x', 'x', 'x', 'x', '-'],
      ['-', 'x', '-', 'x', 'x', '-', 'x', '-', 'x', 'x', 'x', '-', '.'],
      ['-', 'x', 'x', '-', '-', 'x', 'x', 'x', '-', 'x', '-', '.', '.'],
      ['.', '-', '-', 'x', 'x', '-', '-', '-', 'x', '-', '.', '.', '.'],
    ],
    attributes: {
    },
  },
  mark02: {
    layout: [
      ['.', '.', '-', '-', '-', '-', '-', '-', 'x', 'x', '-', '-', '.'],
      ['.', '-', 'l', 'l', 'l', '-', 'x', 'x', '-', '-', 'x', 'x', '-'],
      ['-', 'l', '-', 'l', 'l', '-', 'x', '-', 'x', 'x', '-', 'x', '-'],
      ['-', 'l', 'l', '-', '-', 'o', '-', 'x', 'x', 'x', 'x', '-', 'x'],
      ['-', 'l', 'l', '-', 't', '-', '6', '-', 'o', 'x', 'x', '-', 'x'],
      ['-', '-', '-', 'o', '-', '.', 'i', '.', '-', 'x', '-', 'x', '-'],
      ['-', 'x', 'x', '-', '6', 'n', 's', '-', '6', '-', 'x', 'x', '-'], // center
      ['-', 'x', '-', 'x', '-', '-', '-', '.', '-', 'x', '-', 'x', '-'],
      ['x', '-', 'x', 'x', 'o', '-', '6', '-', 'x', 'x', 'x', '-', 'x'],
      ['x', '-', 'x', 'x', 'x', 'x', '-', 'x', 'x', 'x', 'x', '-', 'x'],
      ['-', 'x', '-', 'x', 'x', '-', 'x', '-', 'x', 'x', '-', 'x', '-'],
      ['-', 'x', 'x', '-', '-', 'x', 'x', 'x', '-', '-', 'x', 'x', '-'],
      ['.', '-', '-', 'x', 'x', '-', '-', '-', 'x', 'x', '-', '-', '.'],
    ],
    attributes: {
    },
  },
}

const flag_colors = new Map<LayoutMark, ColorConstant>(
  [
    // [LAYOUT_MARK_BLANK, null],
    [LAYOUT_MARK_ROAD,      COLOR_BROWN],
    [LAYOUT_MARK_STORAGE,   COLOR_GREEN],
    [LAYOUT_MARK_TERMINAL,  COLOR_PURPLE],
    [LAYOUT_MARK_LINK,      COLOR_ORANGE],
    [LAYOUT_MARK_LAB,       COLOR_BLUE],
    [LAYOUT_MARK_TOWER,     COLOR_RED],
    [LAYOUT_MARK_SPAWN,     COLOR_GREY],
    [LAYOUT_MARK_NUKER,     COLOR_CYAN],
    [LAYOUT_MARK_EXTENSION, COLOR_WHITE],
  ]
)

export interface RoomLayoutOpts {
  allow_partial?: boolean
}

export class RoomLayout {

  public is_partial: boolean = false
  private structures = new Map<LayoutMark, {x:number, y:number}[]>()

  constructor(readonly room: Room, readonly origin_pos: {x:number, y:number}, readonly name: string, readonly opts?: RoomLayoutOpts) {
    opts = opts || {}

    this.parse_layout()
  }

  public show(): void {
    this.structures.forEach((positions, mark) => {
      const flag_color = flag_colors.get(mark)
      const color = color_2_hex(flag_color || COLOR_WHITE)

      console.log(`${mark}: ${positions.length}`)

      positions.forEach((pos) => {
        this.room.visual.text(mark, pos.x, pos.y, {color})
      })
    })
  }

  public place_flags(): void {
    this.structures.forEach((positions, mark) => {
      const flag_color = flag_colors.get(mark)
      if (!flag_color) {
        return
      }

      positions.forEach((pos) => {
        this.room.createFlag(pos.x, pos.y, undefined, flag_color, flag_color)
      })
    })
  }

  // --- private
  private parse_layout() {
    const layout_info = layouts[this.name]
    if (!layout_info) {
      const message = `RoomLayout name ${this.name} does not exists`
      console.log(message)
      Game.notify(message)
      return
    }

    const raw_layout = layout_info.layout
    let y = this.origin_pos.y

    for (const row of raw_layout) {
      let x = this.origin_pos.x

      for (const mark of row) {
        const flag_color = flag_colors.get(mark)

        if (flag_color) {
          const positions = this.structures.get(mark) || []
          positions.push({x, y})

          this.structures.set(mark, positions)
        }
        x += 1
      }
      y += 1
    }
  }

  private calc_layout(center: {x: number, y: number}): LayoutMark[][] | null {
    const layout: LayoutMark[][] = [
      ['-', '.', '-', '-', '-', 'o', '-'],
      ['.', '-', '.', '-', '.', '-', 'o'],
      ['-', '.', '-', 's', '-', '.', '-'],
      ['6', '-', 'i', '0', 't', '-', '6'],
      ['-', '.', '-', 'c', '-', '.', '-'],
      ['o', '-', '.', '-', '.', '-', 'o'],
      ['-', 'o', '-', '6', '-', 'o', '-'],
    ]

    const layout_center = this.center_position(layout)
    if (!layout_center) {
      return null
    }

    const room_name = this.room.name
    const width = layout.length
    if (!layout[0]) {
      console.log(`RoomLayout.calc_layout wrong layout format ${this.room.name}, ${layout}`)
      return null
    }
    const height = layout[0].length

    if ((width == 0) || (height == 0)) {
      console.log(`RoomLayout.calc_layout wrong layout format ${this.room.name}, ${layout}`)
      return null
    }

    // for (let j = 0; j < height; j++) {
    //   for (let i = 0; i < width; i++) {
    //     const x = i - layout_center.x + center.x
    //     const y = j - layout_center.y + center.y
    //     const terrain = Game.map.getTerrainAt(i, j, room_name)

    //     switch (terrain) {
    //       case 'plain':
    //         break

    //       case 'swamp':
    //         break

    //       case 'wall':
    //         cost = unwalkable_cost
    //         break

    //       default: {
    //         cost = unwalkable_cost
    //         const message = `\n${room.name} ${i},${j} unknown terrain`
    //         error_message = !(!error_message) ? (error_message + message) : message
    //         break
    //       }
    //     }

    //     cost_matrix.set(i, j, cost)
    //   }
    // }

    return layout
  }

  private center_position(layout: LayoutMark[][]): {x: number, y: number} | null {
    for (let y = 0; y < layout.length; y++) {
      const row = layout[y]
      if (!row) {
        console.log(`RoomLayout.center_position layout[${y}] missing ${this.room.name}, ${layout}`)
        return null
      }

      for (let x = 0; x < row.length; x++) {
        const mark = row[x]
        if (!mark) {
          console.log(`RoomLayout.center_position layout[${y}][${x}] missing ${this.room.name}, ${layout}`)
          return null
        }

        if (mark != LAYOUT_MARK_CENTER) {
          continue
        }
        return {x, y}
      }
    }

    console.log(`RoomLayout.center_position no center position for ${this.room.name}, ${layout}`)
    return null
  }
}
