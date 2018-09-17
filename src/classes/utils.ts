let index = 0

const leveled_colors: {[index: string]: string} = {
  info: 'white',
  warn: '#F9E79F',
  error: '#E74C3C',
  high: '#64C3F9',
  almost: '#47CAB0',
}

export type ColorLevel = 'info' | 'warn' | 'error' | 'high' | 'almost'
export function leveled_color(level: ColorLevel): string {
  return leveled_colors[level]
}

export function leveled_colored_text(text: string, level: ColorLevel): string {
  const color = leveled_color(level)
  return `<span style='color:${color}'>${text}</span>`
}

export function UID(seed: string): string {
  index += 1
  return `${seed}${Game.time}${index}`
}

export interface StructureFilter {
  (structure: AnyStructure): boolean
}

export function room_link(room_name: string, opts?: {text?: string, color?: string}): string {
  opts = opts || {}
  const color = opts.color || '#FFFFFF'
  const text = opts.text || room_name
  return `<a href="https://screeps.com/a/#!/room/shard2/${room_name}", style='color:${color}'>${text}</a>`
}

export function room_history_link(room_name: string, ticks: number, opts?: {text?: string, color?: string}): string {
  opts = opts || {}
  const color = opts.color || '#FFFFFF'
  const text = opts.text || room_name
  return `<a href="https://screeps.com/a/#!/history/shard2/${room_name}?t=${ticks}", style='color:${color}'>${text}</a>`
}

export function profile_link(username: string, opts?: {color?: string}) {
  opts = opts || {}
  const color = opts.color || '#FFFFFF'
  return `<a href="https://screeps.com/a/#!/profile/${username}", style='color:${color}'>${username}</a>`
}

export function colored_resource_type(resource_type: ResourceConstant): string {
  return `<b><span style='color:${resource_color(resource_type)}'>${resource_type}</span></b>`
}

export function resource_color(resource_type: ResourceConstant): string {
  switch (resource_type) {
    case RESOURCE_ENERGY:
      return '#FFE664'

    case RESOURCE_POWER:
      return '#FF1A30'

    case RESOURCE_OXYGEN:
    case RESOURCE_HYDROGEN:
      return '#FFFFFF'

    case RESOURCE_CATALYST:
      return '#B84C4C'

    case RESOURCE_HYDROXIDE:
    case RESOURCE_UTRIUM_LEMERGITE:
    case RESOURCE_ZYNTHIUM_KEANITE:
      return '#B4B4B4'

    case RESOURCE_GHODIUM:
    case RESOURCE_GHODIUM_OXIDE:
    case RESOURCE_GHODIUM_HYDRIDE:
    case RESOURCE_GHODIUM_ACID:
    case RESOURCE_GHODIUM_ALKALIDE:
    case RESOURCE_CATALYZED_GHODIUM_ACID:
    case RESOURCE_CATALYZED_GHODIUM_ALKALIDE:
      return '#FFFFFF'

    case RESOURCE_UTRIUM:
    case RESOURCE_UTRIUM_HYDRIDE:
    case RESOURCE_UTRIUM_OXIDE:
    case RESOURCE_UTRIUM_ACID:
    case RESOURCE_UTRIUM_ALKALIDE:
    case RESOURCE_CATALYZED_UTRIUM_ACID:
    case RESOURCE_CATALYZED_UTRIUM_ALKALIDE:
      return '#51D7F9'

    case RESOURCE_KEANIUM:
    case RESOURCE_KEANIUM_OXIDE:
    case RESOURCE_KEANIUM_HYDRIDE:
    case RESOURCE_KEANIUM_ACID:
    case RESOURCE_KEANIUM_ALKALIDE:
    case RESOURCE_CATALYZED_KEANIUM_ACID:
    case RESOURCE_CATALYZED_KEANIUM_ALKALIDE:
      return '#A071FF'

    case RESOURCE_LEMERGIUM:
    case RESOURCE_LEMERGIUM_OXIDE:
    case RESOURCE_LEMERGIUM_HYDRIDE:
    case RESOURCE_LEMERGIUM_ACID:
    case RESOURCE_LEMERGIUM_ALKALIDE:
    case RESOURCE_CATALYZED_LEMERGIUM_ACID:
    case RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE:
      return '#00F4A2'

    case RESOURCE_ZYNTHIUM:
    case RESOURCE_ZYNTHIUM_OXIDE:
    case RESOURCE_ZYNTHIUM_HYDRIDE:
    case RESOURCE_ZYNTHIUM_ACID:
    case RESOURCE_ZYNTHIUM_ALKALIDE:
    case RESOURCE_CATALYZED_ZYNTHIUM_ACID:
    case RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE:
      return '#FDD388'

    default:
      console.log(`resource_color undefined resource ${resource_type}`)
      return '#FFFFFF'
  }
}

export function colored_body_part(body_part: BodyPartConstant): string {
  return `<b><span style='color:${body_part_color(body_part)}'>${body_part}</span></b>`
}

export function body_part_color(body_part: BodyPartConstant): string {
  switch (body_part) {
    case MOVE:
      return '#A9B7C6'

    case WORK:
      return '#FFE56D'

    case CARRY:
      return '#777777'

    case ATTACK:
      return '#F93843'

    case RANGED_ATTACK:
      return '#5D80B2'

    case HEAL:
      return '#65FD62'

    case CLAIM:
      return '#B99CFB'

    case TOUGH:
      return '#FFFFFF'

    default:
      console.log(`body_part_color undefined body_part ${body_part}`)
      return '#FFFFFF'
  }
}
