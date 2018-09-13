
type STRUCTURE_SPAIR = 'spair'
type StructureConstantForRoomLayout = StructureConstant | STRUCTURE_SPAIR

type LayoutMarkCenter    = '00'
const LAYOUT_MARK_CENTER = '00'

type LayoutMarkSpair     = '..'
const LAYOUT_MARK_Spair  = '..'

type LayoutMarkRoad      = '--'
const LAYOUT_MARK_ROAD   = '--'

type LayoutMarkStorage   = 'st'
const LAYOUT_MARK_STORAGE = 'st'

type LayoutMarkTerminal  = 'te'
const LAYOUT_MARK_TERMINAL = 'te'

type LayoutMarkLink      = 'li'
const LAYOUT_MARK_LINK   = 'li'

type LayoutMarkContainer = 'co'
const LAYOUT_MARK_CONATINER = 'co'

type LayoutMarkTower     = 'to'
const LAYOUT_MARK_TOWER  = 'to'

type LayoutMarkSpawn     = 'sp'
const LAYOUT_MARK_SPAWN  = 'sp'

type StructureMark = LayoutMarkStorage
  | LayoutMarkTerminal
  | LayoutMarkLink
  | LayoutMarkContainer
  | LayoutMarkTower
  | LayoutMarkSpawn

type LayoutMark = StructureMark
  | LayoutMarkCenter
  | LayoutMarkSpair
  | LayoutMarkRoad

export interface RoomLayoutOpts {
  allow_partial?: boolean
}

export class RoomLayout {

  public is_partial: boolean

  private structures: {[x: number]: {[y: number]: StructureConstant}}

  constructor(readonly room: Room, readonly center: {x: number, y: number}, opts?: RoomLayoutOpts) {
    opts = opts || {}



    throw new Error()
  }

  public show(): void {

  }

  public place_flags(): void {

  }

  // --- private
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
