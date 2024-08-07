import { Environment } from "utility/environment"
import type { RoomName } from "../room_name_types"

export type SemanticTextColor = "info" | "warn" | "error" | "critical" | "high" | "almost"
export type NativeTextColor = "white" | "yellow" | "green" | "blue" | "orange" | "red"

export type TextColor = SemanticTextColor | NativeTextColor
const textColors: { [index in TextColor]: string } = {
  // Log level
  info: "white",
  warn: "#F9E79F",
  error: "#F78C6C",
  critical: "#E74C3C",

  // Capacity level
  high: "#64C3F9",    // blue
  almost: "#47CAB0",  // green

  // Native color
  white: "white",
  yellow: "#F9E79F",
  green: "#47CAB0",
  blue: "#64C3F9",
  orange: "#F78C6C",
  red: "#E74C3C",
}

type Tab = number
export const TabSize = {
  veryVeryLarge: 50,
  veryLarge: 40,
  large: 30,
  medium: 20,
  small: 10,
}

const spaces = "                                                  " // 50 spaces

export const colored = (text: string, color: TextColor | "none"): string => {
  if (color === "none") {
    return text
  }

  return coloredText(text, textColors[color])
}

export const safe = (text: string): string => {
  return text.replace("<", "&lt").replace(">", "&gt")
}

export const tab = (text: string, tabSize: Tab, originalText?: string): string => {
  const numberOfSpaces = Math.max(tabSize - (originalText ?? text).length, 0)
  const spacer = spaces.slice(0, numberOfSpaces)
  return `${text}${spacer}`
}

const coloredText = (text: string, color: string): string => {
  return `<font style='color:${color}'>${text}</font>`
}

export const shortenedNumber = (num: number): string => {
  if (num < 2000) {
    return `${num}`
  }
  if (num < 2000000) {
    return `${Math.floor(num / 1000)}k`
  }
  return `${Math.floor(num / 1000000)}M`
}

const baseUrl = ((): string => {
  switch (Environment.world) {
  case "persistent world":
  case "simulation":
  case "botarena":
  case "private":
  case "non game":
  case "unknown":
    return "https://screeps.com/a/#!"
  case "season 4":
  case "season 5":
    return "https://screeps.com/season/#!"
  case "swc":
    return "http://swc.screepspl.us/#!"
  }
})()

export const roomLink = (roomName: RoomName): string => {
  return `<a href="${baseUrl}/room/${Game.shard.name}/${roomName}", style='color:#FFFFFF'>${roomName}</a>`
}

export const roomHistoryLink = (roomName: RoomName, ticks: number): string => {
  return `<a href="${baseUrl}/history/${Game.shard.name}/${roomName}?t=${ticks}", style='color:#FFFFFF'>${roomName}</a>`
}

export const profileLink = (username: string): string => {
  return `<a href="${baseUrl}/profile/${username}", style='color:#FFFFFF'>${username}</a>`
}

export const coloredResourceType = (resourceType: ResourceConstant): string => {
  return `<b>${coloredText(resourceType, getResourceColorCode(resourceType))}</b>`
}

export const coloredCreepBody = (body: BodyPartConstant): string => {
  return `<b>${coloredText(body.toUpperCase(), getCreepBodyColorCode(body))}</b>`
}

export const ordinalNumber = (n: number): string => {
  switch (n % 10) {
  case 1:
    return `${n}st`
  case 2:
    return `${n}nd`
  case 3:
    return `${n}rd`
  default:
    return `${n}th`
  }
}

const getResourceColorCode = (resourceType: ResourceConstant): string => {
  switch (resourceType) {
  case RESOURCE_ENERGY:
  case RESOURCE_BATTERY:
    return "#FFE664"

  case RESOURCE_POWER:
  case RESOURCE_PURIFIER:
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
  case RESOURCE_GHODIUM_MELT:
    return "#FFFFFF"

  case RESOURCE_UTRIUM:
  case RESOURCE_UTRIUM_HYDRIDE:
  case RESOURCE_UTRIUM_OXIDE:
  case RESOURCE_UTRIUM_ACID:
  case RESOURCE_UTRIUM_ALKALIDE:
  case RESOURCE_CATALYZED_UTRIUM_ACID:
  case RESOURCE_CATALYZED_UTRIUM_ALKALIDE:
  case RESOURCE_UTRIUM_BAR:
    return "#51D7F9"

  case RESOURCE_KEANIUM:
  case RESOURCE_KEANIUM_OXIDE:
  case RESOURCE_KEANIUM_HYDRIDE:
  case RESOURCE_KEANIUM_ACID:
  case RESOURCE_KEANIUM_ALKALIDE:
  case RESOURCE_CATALYZED_KEANIUM_ACID:
  case RESOURCE_CATALYZED_KEANIUM_ALKALIDE:
  case RESOURCE_KEANIUM_BAR:
    return "#A071FF"

  case RESOURCE_LEMERGIUM:
  case RESOURCE_LEMERGIUM_OXIDE:
  case RESOURCE_LEMERGIUM_HYDRIDE:
  case RESOURCE_LEMERGIUM_ACID:
  case RESOURCE_LEMERGIUM_ALKALIDE:
  case RESOURCE_CATALYZED_LEMERGIUM_ACID:
  case RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE:
  case RESOURCE_LEMERGIUM_BAR:
    return "#00F4A2"

  case RESOURCE_ZYNTHIUM:
  case RESOURCE_ZYNTHIUM_OXIDE:
  case RESOURCE_ZYNTHIUM_HYDRIDE:
  case RESOURCE_ZYNTHIUM_ACID:
  case RESOURCE_ZYNTHIUM_ALKALIDE:
  case RESOURCE_CATALYZED_ZYNTHIUM_ACID:
  case RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE:
  case RESOURCE_ZYNTHIUM_BAR:
    return "#FDD388"

  case RESOURCE_OXIDANT:
  case RESOURCE_REDUCTANT:
    return "#A7A7A7"

  case RESOURCE_SILICON:
  case RESOURCE_WIRE:
  case RESOURCE_SWITCH:
  case RESOURCE_TRANSISTOR:
  case RESOURCE_MICROCHIP:
  case RESOURCE_CIRCUIT:
  case RESOURCE_DEVICE:
    return "#50A6E5"

  case RESOURCE_BIOMASS:
  case RESOURCE_CELL:
  case RESOURCE_PHLEGM:
  case RESOURCE_TISSUE:
  case RESOURCE_MUSCLE:
  case RESOURCE_ORGANOID:
  case RESOURCE_ORGANISM:
    return "#86B314"

  case RESOURCE_METAL:
  case RESOURCE_ALLOY:
  case RESOURCE_TUBE:
  case RESOURCE_FIXTURES:
  case RESOURCE_FRAME:
  case RESOURCE_HYDRAULICS:
  case RESOURCE_MACHINE:
    return "#946F5C"

  case RESOURCE_MIST:
  case RESOURCE_CONDENSATE:
  case RESOURCE_CONCENTRATE:
  case RESOURCE_EXTRACT:
  case RESOURCE_SPIRIT:
  case RESOURCE_EMANATION:
  case RESOURCE_ESSENCE:
    return "#D85DF5"

  case RESOURCE_COMPOSITE:
  case RESOURCE_CRYSTAL:
  case RESOURCE_LIQUID:
    return "#FFFFFF"

  default:
    return "#FFFFFF"
  }
}

const getCreepBodyColorCode = (body: BodyPartConstant): string => {
  switch (body) {
  case WORK:
    return "#FFE76E"
  case CARRY:
    return "#777777"
  case MOVE:
    return "#A9B7C6"
  case CLAIM:
    return "#B897FB"
  case ATTACK:
    return "#F62843"
  case RANGED_ATTACK:
    return "#5E7EB2"
  case HEAL:
    return "#6DFF63"
  case TOUGH:
    return "#FFFFFF"
  }
}
