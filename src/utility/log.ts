import { Environment } from "./environment"

const textColors: { [index: string]: string } = {
  // Log level
  info: "white",
  warn: "#F9E79F",
  error: "#F78C6C",
  critical: "#E74C3C",

  // Capacity level
  high: "#64C3F9",    // blue
  almost: "#47CAB0",  // green
}

export type TextColor = "info" | "warn" | "error" | "critical" | "high" | "almost"
export function textColor(color: TextColor): string {
  return textColors[color] ?? "white"
}

export function coloredText(text: string, color: TextColor): string {
  const colorValue = textColor(color)
  return anyColoredText(text, colorValue)
}

export function anyColoredText(text: string, color: string): string {
  return `<span style='color:${color}'>${text}</span>`
}

function baseUrl(): string {
  const path = ((): string => {
    switch (Environment.world) {
    case "persistent world":
    case "simulation":
      return "a"
    case "season 3":
      return "season"
    }
  })()
  return `https://screeps.com/${path}/#!`
}

export function roomLink(roomName: string, opts?: { text?: string, color?: string }): string {
  opts = opts || {}
  const color = opts.color || "#FFFFFF"
  const text = opts.text || roomName
  return `<a href="${baseUrl()}/room/${Game.shard.name}/${roomName}", style='color:${color}'>${text}</a>`
}

export function profileLink(username: string, colorCode?: string): string {
  const color = colorCode || "#FFFFFF"
  return `<a href="${baseUrl()}/profile/${username}", style='color:${color}'>${username}</a>`
}

export function coloredResourceType(resourceType: ResourceConstant): string {
  return `<b><span style='color:${resourceColorCode(resourceType)}'>${resourceType}</span></b>`
}

export function resourceColorCode(resourceType: ResourceConstant): string {
  switch (resourceType) {
  case RESOURCE_ENERGY:
    return "#FFE664"

  case RESOURCE_POWER:
    return "#FF1A30"

  case RESOURCE_OXYGEN:
  case RESOURCE_HYDROGEN:
    return "#FFFFFF"

  case RESOURCE_CATALYST:
    return "#B84C4C"

  case RESOURCE_HYDROXIDE:
  case RESOURCE_UTRIUM_LEMERGITE:
  case RESOURCE_ZYNTHIUM_KEANITE:
    return "#B4B4B4"

  case RESOURCE_GHODIUM:
  case RESOURCE_GHODIUM_OXIDE:
  case RESOURCE_GHODIUM_HYDRIDE:
  case RESOURCE_GHODIUM_ACID:
  case RESOURCE_GHODIUM_ALKALIDE:
  case RESOURCE_CATALYZED_GHODIUM_ACID:
  case RESOURCE_CATALYZED_GHODIUM_ALKALIDE:
    return "#FFFFFF"

  case RESOURCE_UTRIUM:
  case RESOURCE_UTRIUM_HYDRIDE:
  case RESOURCE_UTRIUM_OXIDE:
  case RESOURCE_UTRIUM_ACID:
  case RESOURCE_UTRIUM_ALKALIDE:
  case RESOURCE_CATALYZED_UTRIUM_ACID:
  case RESOURCE_CATALYZED_UTRIUM_ALKALIDE:
    return "#51D7F9"

  case RESOURCE_KEANIUM:
  case RESOURCE_KEANIUM_OXIDE:
  case RESOURCE_KEANIUM_HYDRIDE:
  case RESOURCE_KEANIUM_ACID:
  case RESOURCE_KEANIUM_ALKALIDE:
  case RESOURCE_CATALYZED_KEANIUM_ACID:
  case RESOURCE_CATALYZED_KEANIUM_ALKALIDE:
    return "#A071FF"

  case RESOURCE_LEMERGIUM:
  case RESOURCE_LEMERGIUM_OXIDE:
  case RESOURCE_LEMERGIUM_HYDRIDE:
  case RESOURCE_LEMERGIUM_ACID:
  case RESOURCE_LEMERGIUM_ALKALIDE:
  case RESOURCE_CATALYZED_LEMERGIUM_ACID:
  case RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE:
    return "#00F4A2"

  case RESOURCE_ZYNTHIUM:
  case RESOURCE_ZYNTHIUM_OXIDE:
  case RESOURCE_ZYNTHIUM_HYDRIDE:
  case RESOURCE_ZYNTHIUM_ACID:
  case RESOURCE_ZYNTHIUM_ALKALIDE:
  case RESOURCE_CATALYZED_ZYNTHIUM_ACID:
  case RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE:
    return "#FDD388"

  default:
    return "#FFFFFF"
  }
}
