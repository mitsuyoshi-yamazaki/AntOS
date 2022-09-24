import { Process } from "process/process"
import { coloredText, roomLink, Tab, tab } from "utility/log"
import { Season2055924SendResourcesProcess } from "process/temporary/season_2055924_send_resources_process"
import { PowerCreepProcess } from "process/process/power_creep/power_creep_process"
import { HighwayProcessLauncherProcess } from "process/process/highway_process_launcher_process"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { KeywordArguments } from "shared/utility/argument_parser/keyword_argument_parser"
import { OperatingSystem } from "os/os"
import { isOwnedRoomProcess, OwnedRoomProcess } from "process/owned_room_process"
import { RoomResources } from "room_resource/room_resources"

export const unclaim = (roomResource: OwnedRoomResource, args: string[]): string => {
  const keywordArguments = new KeywordArguments(args)
  const dryRun = keywordArguments.boolean("dry_run").parseOptional() ?? true

  return unclaimRoom(roomResource, dryRun)
}

const unclaimRoom = (roomResource: OwnedRoomResource, dryRun: boolean): string => {
  const roomName = roomResource.room.name
  const processesToKill: (Process & OwnedRoomProcess)[] = []

  OperatingSystem.os.listAllProcesses().forEach(processInfo => {
    const process = processInfo.process
    if (!isOwnedRoomProcess(process)) {
      return
    }
    if (process.ownedRoomName !== roomName) {
      return
    }
    processesToKill.push(process)
  })

  const messages: string[] = []

  const processDescriptions = processesToKill.map(process => {
    const shortDescription = process.processShortDescription != null ? process.processShortDescription() : ""
    return `- ${tab(`${process.processId}`, Tab.medium)}: ${tab(`${process.constructor.name}`, Tab.veryLarge)} ${tab(shortDescription, Tab.medium)}`
  })
  messages.push(coloredText(`${processesToKill.length} processes to remove:`, "info"))
  messages.push(...processDescriptions)

  const room = Game.rooms[roomName]
  const flags: Flag[] = []
  const constructionSiteCounts = new Map<StructureConstant, number>()
  const constructionSites: ConstructionSite<BuildableStructureConstant>[] = []
  const ownedStructures: AnyOwnedStructure[] = []

  if (room != null) {
    constructionSites.push(...room.find(FIND_CONSTRUCTION_SITES))
    ownedStructures.push(...room.find(FIND_MY_STRUCTURES))
    flags.push(...room.find(FIND_FLAGS))
  } else {
    flags.push(...Array.from(Object.values(Game.flags)).filter(flag => flag.pos.roomName === roomName))
  }

  constructionSites.forEach(constructionSite => {
    const structureType = constructionSite.structureType
    const count = constructionSiteCounts.get(structureType) ?? 0
    constructionSiteCounts.set(structureType, count + 1)
  })

  if (constructionSiteCounts.size > 0) {
    const constructionSiteDescriptions = Array.from(constructionSiteCounts.entries()).map(([structureType, count]) => {
      return `- ${tab(structureType, Tab.medium)}: ${count}`
    })
    messages.push(coloredText("Construction sites to remove:", "info"))
    messages.push(...constructionSiteDescriptions)
  }

  if (ownedStructures.length > 0) {
    messages.push(coloredText(`${ownedStructures.length} owned structures`, "info"))
  }

  if (flags.length > 0) {
    messages.push(coloredText(`${flags.length} flags`, "info"))
  }

  if (dryRun === true) {
    messages.unshift(`${coloredText("[Unclaim room]", "warn")} (dry run):`)
  } else {
    if (room != null && room.controller != null && room.controller.my === true) {
      const result = room.controller.unclaim()
      switch (result) {
      case OK:
        break
      default:
        messages.unshift(`${coloredText("[Unclaim room]", "error")}: FAILED ${result}:`)
        return messages.join("\n")
      }
    }

    messages.unshift(`${coloredText("[Unclaim room]", "error")}:`)

    processesToKill.forEach(process => {
      OperatingSystem.os.killProcess(process.processId)
    })
    constructionSites.forEach(constructionSite => {
      constructionSite.remove()
    })
    flags.forEach(flag => {
      flag.remove()
    })
    ownedStructures.forEach(structure => {
      structure.notifyWhenAttacked(false)
    })

    RoomResources.removeRoomInfo(roomName)
  }

  return messages.join("\n")
}

export const prepareUnclaim = (roomResource: OwnedRoomResource, args: string[]): string => {
  const results: string[] = []

  const keywordArguments = new KeywordArguments(args)
  const roomName = roomResource.room.name

  // Send Resource
  if (roomResource.activeStructures.terminal != null) {
    const targetSectorNames = keywordArguments.list("transfer_target_sector_names", "room_name").parse()
    const excludedResourceTypes = ((): ResourceConstant[] => {
      const given = keywordArguments.list("excluded_resource_types", "resource").parseOptional()
      if (given != null) {
        return given
      }
      return [
        RESOURCE_KEANIUM,
        RESOURCE_LEMERGIUM,
        RESOURCE_UTRIUM,
        RESOURCE_ZYNTHIUM,
        RESOURCE_OXYGEN,
        RESOURCE_HYDROGEN,
        RESOURCE_CATALYST,
      ]
    })()

    const process = OperatingSystem.os.addProcess(null, processId => {
      return Season2055924SendResourcesProcess.create(processId, roomName, targetSectorNames, excludedResourceTypes)
    })
    results.push(`send resource process ${process.processId} launched`)
  }

  // Stop Mineral Harvesting
  roomResource.roomInfoAccessor.config.mineralMaxAmount = 0
  results.push("stopped mineral harvesting")

  OperatingSystem.os.listAllProcesses().forEach(processInfo => {
    const process = processInfo.process
    if (process instanceof HighwayProcessLauncherProcess) {
      const baseRemovalResult = process.removeBase(roomName)
      switch (baseRemovalResult) {
      case "removed":
        results.push(`base removed from ${process.constructor.name}`)
        break
      case "no base":
        break
      default: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _: never = baseRemovalResult
        break
      }
      }
      return
    }
    if (process instanceof PowerCreepProcess) {
      if (process.parentRoomName === roomName) {
        process.suicidePowerCreep()
        results.push(`commanded suicide PowerCreep ${process.powerCreepName}`)
      }
      return
    }
  })

  return [
    `preparing unclaim ${roomLink(roomName)}`,
    ...results.map(r => `- ${r}`),
  ].join("\n")
}
