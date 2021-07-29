import { coloredResourceType, coloredText, profileLink, resourceColorCode, roomLink, textColor, TextColor } from "utility/log"
import { generateUniqueId } from "utility/unique_id"

export function room_link(room_name: string, opts?: { text?: string, color?: string }): string {
  return roomLink(room_name, opts)
}

export function UID(seed: string): string {
  return generateUniqueId(seed)
}

// ---- Old code ---- //
/* eslint-disable */
export function log(obj: any): void {
  console.log(obj)  // tslint:disable-line: no-console
}

export function getSectorName(room_name: string): string | null {

  const parsed = /^([WE])([0-9]+)([NS])([0-9]+)$/.exec(room_name)
  if (!parsed || (parsed.length < 5)) {
    return null
  }

  const h_direction = parsed[1] as string
  const h_position = Number(parsed[2])
  const v_direction = parsed[3] as string
  const v_position = Number(parsed[4])

  const h = (Math.floor(h_position / 10) * 10) + 5
  const v = (Math.floor(v_position / 10) * 10) + 5

  return `${h_direction}${h}${v_direction}${v}`
}

export type ColorLevel = TextColor
export function leveled_color(level: ColorLevel): string {
  return textColor(level)
}

export function leveled_colored_text(text: string, level: ColorLevel): string {
  return coloredText(text, level)
}

export interface StructureFilter {
  (structure: AnyStructure): boolean
}

export function room_history_link(room_name: string, ticks: number, opts?: {text?: string, color?: string}): string {
  opts = opts || {}
  const color = opts.color || '#FFFFFF'
  const text = opts.text || room_name
  return `<a href="https://screeps.com/a/#!/history/shard2/${room_name}?t=${ticks}", style='color:${color}'>${text}</a>`
}

export function profile_link(username: string, opts?: {color?: string}) {
  return profileLink(username, opts?.color)
}

export function colored_resource_type(resource_type: ResourceConstant): string {
  return coloredResourceType(resource_type)
}

export function resource_color(resource_type: ResourceConstant): string {
  return resourceColorCode(resource_type)
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

export function color_2_hex(color: ColorConstant): string {
  switch (color) {
    case COLOR_RED:
      return '#ff0000'

    case COLOR_PURPLE:
      return '#ff00ff'

    case COLOR_BLUE:
      return '#0000ff'

    case COLOR_CYAN:
      return '#00ffff'

    case COLOR_GREEN:
      return '#00ff00'

    case COLOR_YELLOW:
      return '#ffff00'

    case COLOR_ORANGE:
      return '#ffa500'

    case COLOR_BROWN:
      return '#8b4513'

    case COLOR_GREY:
      return '#d3d3d3'

    case COLOR_WHITE:
      return '#ffffff'

    default:
      return '#ffffff'
  }
}
