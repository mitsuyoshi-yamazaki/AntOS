
/**
 * https://screeps.com/a/#!/room/shard2/W11S52
 * https://screeps.com/a/#!/room/shard1/E22N32
 */

type STRUCTURE_SPARE= 'spare'
type StructureConstantForRoomLayout = StructureConstant | STRUCTURE_SPARE

type LayoutMarkCenter    = '00'
const LAYOUT_MARK_CENTER = '00'

type LayoutMarkBlank     = '..'
const LAYOUT_MARK_BLANK  = '..'

type LayoutMarkSpare     = '**'
const LAYOUT_MARK_SPARE  = '**'

type LayoutMarkRoad      = '--'
const LAYOUT_MARK_ROAD   = '--'

type LayoutMarkStorage   = 'st'
const LAYOUT_MARK_STORAGE = 'st'

type LayoutMarkTerminal  = 'te'
const LAYOUT_MARK_TERMINAL = 'te'

type LayoutMarkLink      = 'li'
const LAYOUT_MARK_LINK   = 'li'

type LayoutMarkLab       = 'la'
const LAYOUT_MARK_LAB    = 'la'

type LayoutMarkContainer = 'co'
const LAYOUT_MARK_CONATINER = 'co'

type LayoutMarkTower     = 'to'
const LAYOUT_MARK_TOWER  = 'to'

type LayoutMarkSpawn     = 'sp'
const LAYOUT_MARK_SPAWN  = 'sp'

type LayoutMarkNuker     = 'nu'
const LAYOUT_MARK_NUKER  = 'nu'

type LayoutMarkExtension     = 'ex'
const LAYOUT_MARK_EXTENSION  = 'ex'

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

const layouts: {[name: string]: LayoutMark[][]} = {
  mark01: [
    ['..', '..', '--', '--', '--', '--', '--', '--', 'ex', 'ex', '--', '--', '..'],
    ['..', '--', 'la', 'la', 'la', '--', 'ex', 'ex', '--', '--', 'ex', 'ex', '--'],
    ['--', 'la', '--', 'la', 'la', '--', 'ex', '--', 'ex', 'ex', '--', 'ex', '--'],
    ['--', 'la', 'la', '--', '--', 'to', '--', 'ex', 'ex', 'ex', 'ex', '--', 'ex'],
    ['--', 'la', 'la', '--', 'te', '--', 'sp', '--', 'to', 'ex', 'ex', '--', 'ex'],
    ['--', '--', '--', 'to', '--', '..', 'li', '..', '--', 'ex', '--', 'ex', '--'],
    ['--', 'ex', 'ex', '--', 'sp', 'nu', 'st', '--', 'sp', '--', 'ex', 'ex', '--'], // center
    ['--', 'ex', '--', 'ex', '--', '--', 'to', '..', '--', 'ex', '--', 'ex', '--'],
    ['ex', '--', 'ex', 'ex', 'to', '--', 'sp', '--', 'ex', 'ex', 'ex', '--', 'ex'],
    ['ex', '--', 'ex', 'ex', 'ex', 'ex', '--', 'ex', 'ex', 'ex', 'ex', 'ex', '--'],
    ['--', 'ex', '--', 'ex', 'ex', '--', 'ex', '--', 'ex', 'ex', 'ex', '--', '..'],
    ['--', 'ex', 'ex', '--', '--', 'ex', 'ex', 'ex', '--', 'ex', '--', '..', '..'],
    ['..', '--', '--', 'ex', 'ex', '--', '--', '--', 'ex', '--', '..', '..', '..'],
  ],
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
      // const flag_color = flag_colors.get(mark) // color text

      positions.forEach((pos) => {
        this.room.visual.text(mark, pos.x, pos.y, {color: '#ffffff'})
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
    const raw_layout = layouts[this.name]
    if (!raw_layout) {
      const message = `RoomLayout name ${this.name} does not exists`
      console.log(message)
      Game.notify(message)
      return
    }

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
      ['--', '..', '--', '--', '--', 'to', '--'],
      ['..', '--', '..', '--', '..', '--', 'to'],
      ['--', '..', '--', 'st', '--', '..', '--'],
      ['sp', '--', 'li', '00', 'te', '--', 'sp'],
      ['--', '..', '--', 'co', '--', '..', '--'],
      ['to', '--', '..', '--', '..', '--', 'to'],
      ['--', 'to', '--', 'sp', '--', 'to', '--'],
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
