import { OperatingSystem } from "os/os"
import { World35587255ScoutRoomProcess } from "process/temporary/world_35587255_scout_room_process"
import { describePosition } from "prototype/room_position"
import { isOwnedRoomTypes, OwnedRoomInfo, RemoteRoomInfo } from "room_resource/room_info"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { coloredResourceType, coloredText, roomLink, shortenedNumber } from "utility/log"
import { powerName } from "shared/utility/power"
import { isMineralBoostConstant, isMineralCompoundConstant } from "shared/utility/resource"
import type { RoomName } from "shared/utility/room_name_types"
import { KeywordArguments } from "../../../../shared/utility/argument_parser/keyword_argument_parser"
import { ListArguments } from "../../../../shared/utility/argument_parser/list_argument_parser"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { strictEntries } from "shared/utility/strict_entries"

const numberAccessorCommands = [
  "mineral_max_amount",
  "construction_interval",
  "concurrent_construction_site_count",
  "wall_max_hits",
] as const
type NumberAccessorCommands = typeof numberAccessorCommands[number]

// Game.io("exec room_config <room name> <command> ...")
/** @throws */
export function execRoomConfigCommand(roomResource: OwnedRoomResource, args: string[]): string {
  const oldCommandList = ["wall_positions", "refresh_research_labs"]
  const commandList: string[] = [
    "help",
    "waiting_position",
    "powers",
    "boosts",
    "set_remote_room_path_cache_enabled",
    "change_room_type",
    "toggle_remote",
    "remote",
    "toggle_auto_attack",
    "show_labs",
    "clear_research_labs",
    "no_repair_walls",
    "research",
    ...numberAccessorCommands,
    ...oldCommandList,
  ]

  const listArguments = new ListArguments(args)
  const command = listArguments.string(0, "command").parse()
  args.shift()

  const roomName = roomResource.room.name
  const roomInfo = roomResource.roomInfo

  switch (command) {
  case "help":
    return `Commands:\n${commandList.join("\n")}`

  case "waiting_position":
    return waitingPosition(roomResource, args)
  case "powers":
    return powers(roomResource, args)
  case "boosts":
    return boosts(roomResource, args)
  case "change_room_type":
    return changeRoomType(roomResource, args)
  case "toggle_remote":
    return toggleRemoteRoom(roomResource, args)
  case "remote":
    return remote(roomResource, args)
  case "toggle_auto_attack":
    return toggleAutoAttack(roomResource, args)
  case "show_labs":
    return showLabs(roomResource)
  case "clear_research_labs":
    return clearResearchLabs(roomResource)
  case "no_repair_walls":
    return noRepairWalls(roomResource, args)
  case "research":
    return research(roomResource, args)
  case "mineral_max_amount":
  case "construction_interval":
  case "concurrent_construction_site_count":
  case "wall_max_hits":
    return accessNumberProperty(command, roomResource, args)

    // ---- Old Commands ---- //
  case "wall_positions":
    return configureWallPositions(roomName, roomInfo, parseProcessArguments(args))
  case "refresh_research_labs":
    return refreshResearchLabs(roomName, roomResource, parseProcessArguments(args))
  // case "disable_boost_labs": // TODO: 消す
  //   return disableBoostLabs(roomName, roomInfo)
  default:
    throw `Invalid command ${command}, see "help"`
  }
}

/** @throws */
const research = (roomResource: OwnedRoomResource, args: string[]): string => {
  const commands = ["help", "show", "add", "clear"]
  const listArguments = new ListArguments(args)

  const getCurentSettings = (): string => {
    const entries = Object.entries(roomResource.roomInfo.config?.researchCompounds ?? {})
    if (entries.length <= 0) {
      return "no research compounds"
    }
    return entries
      .map(([compoundType, amount]) => `\n- ${coloredResourceType(compoundType as MineralCompoundConstant)}: ${amount}`)
      .join("")
  }

  const command = listArguments.string(0, "command").parse()
  switch (command) {
  case "help":
    return `commands: ${commands.join(", ")}`

  case "show":
    return getCurentSettings()

  case "add": {
    const compoundType = listArguments.typedString(1, "compound type", "MineralCompoundConstant", isMineralCompoundConstant).parse()
    const amount = listArguments.int(2, "amount").parse({min: 1})

    if (roomResource.roomInfo.config == null) {
      roomResource.roomInfo.config = {}
    }

    if (roomResource.roomInfo.config.researchCompounds == null) {
      roomResource.roomInfo.config.researchCompounds = {}
    }

    const oldValue = roomResource.roomInfo.config.researchCompounds[compoundType] ?? null
    roomResource.roomInfo.config.researchCompounds[compoundType] = amount

    if (oldValue != null) {
      return `${coloredText("Updated:", "info")} ${coloredResourceType(compoundType)} (${oldValue} =&gt ${amount}): ${getCurentSettings()}`
    }
    return `${coloredText("Added:", "info")} ${coloredResourceType(compoundType)}: ${getCurentSettings()}`
  }

  case "clear": {
    const currentSettings = getCurentSettings()
    if (roomResource.roomInfo.config == null) {
      roomResource.roomInfo.config = {}
    }
    roomResource.roomInfo.config.researchCompounds = {}
    return `${coloredText("cleared", "info")}: ${currentSettings}`
  }

  default:
    throw `invalid command ${command}, specify ${commands.join(", ")}`
  }
}

/** @throws */
function noRepairWalls(roomResource: OwnedRoomResource, args: string[]): string {
  const listArguments = new ListArguments(args)
  const command = listArguments.string(0, "command").parse()

  switch (command) {
  case "add":
    return addNoRepairWalls(roomResource, listArguments.list(1, "wall IDs", "object_id").parse())

  case "show":
    showNoRepairWalls(roomResource)
    return `no repair wall IDs:\n${roomResource.roomInfoAccessor.config.getNoRepairWallIds().join("\n")}`

  case "refresh":
    return refreshNoRepairWalls(roomResource)

  default:
    throw `invalid command ${command}, available commands: add, show, refresh`
  }
}

const refreshNoRepairWalls = (roomResource: OwnedRoomResource): string => {
  const ids = [...roomResource.roomInfoAccessor.config.getNoRepairWallIds()]
  roomResource.roomInfoAccessor.config.removeNoRepairWallIds()

  const existingIds = ids.filter(id => {
    const wall = Game.getObjectById(id)
    if (wall == null) {
      return false
    }
    return true
  })
  roomResource.roomInfoAccessor.config.addNoRepairWallIds(existingIds)

  return `removed ${ids.length - existingIds.length} ids`
}

/** @throws */
const addNoRepairWalls = (roomResource: OwnedRoomResource, rawWallIds: string[]): string => {
  const wallIds = rawWallIds.flatMap((rawId): Id<StructureWall | StructureRampart>[] => {
    const wall = Game.getObjectById(rawId)
    if (!(wall instanceof StructureWall) && !(wall instanceof StructureRampart)) {
      throw `${wall} is not wall or rampart`
    }
    return [wall.id]
  })

  roomResource.roomInfoAccessor.config.addNoRepairWallIds(wallIds)

  return `${wallIds.length} walls excluded`
}

const showNoRepairWalls = (roomResource: OwnedRoomResource): void => {
  const walls = roomResource.roomInfoAccessor.config.getNoRepairWallIds().flatMap((id): (StructureWall | StructureRampart)[] => {
    const wall = Game.getObjectById(id)
    if (wall == null) {
      return []
    }
    return [wall]
  })
  walls.forEach(wall => {
    roomResource.room.visual.text("@", wall.pos.x, wall.pos.y, {color: "#FF0000"})
  })
}

/** @throws */
function showLabs(roomResource: OwnedRoomResource): string {
  type LabDescription = {
    readonly labType: string
    readonly lab: StructureLab
    readonly text: string
    readonly color: string
  }
  const labs: LabDescription[] = []

  const boostLabs: LabDescription[] = roomResource.roomInfoAccessor.boostLabs.map(labInfo => ({
    labType: ConsoleUtility.coloredResourceType(labInfo.boost),
    lab: labInfo.lab,
    text: (labInfo.boost[0] ?? "").toUpperCase(),
    color: coloredResourceType(labInfo.boost),
  }))
  labs.push(...boostLabs)

  const researchLabs = roomResource.roomInfoAccessor.researchLabs
  if (researchLabs != null) {
    const researchLabTextColor = "#000000"
    labs.push({
      labType: "research input",
      lab: researchLabs.inputLab1,
      text: "i",
      color: researchLabTextColor,
    })
    labs.push({
      labType: "research input",
      lab: researchLabs.inputLab2,
      text: "i",
      color: researchLabTextColor,
    })
    labs.push(...researchLabs.outputLabs.map((lab): LabDescription => {
      return {
        labType: "research output",
        lab,
        text: "o",
        color: researchLabTextColor,
      }
    }))
  }

  const researchLabDescription = ((): string => {
    if (researchLabs == null) {
      return "no research labs"
    }
    return `${researchLabs.outputLabs.length} research output labs`
  })()

  const results: string[] = [
    `- ${boostLabs.length} boost labs`,
    `- ${researchLabDescription}`,
    "- labs:",
  ]

  labs.forEach(labDescription => {
    const position = labDescription.lab.pos
    roomResource.room.visual.text(labDescription.text, position.x, position.y, { color: labDescription.color, strokeWidth: 0.3 })
    results.push(`  - (${position.x},${position.y}) ${labDescription.labType}`)
  })


  return results.join("\n")
}

function clearResearchLabs(roomResource: OwnedRoomResource): string {
  const researchLabs = roomResource.roomInfoAccessor.researchLabs
  if (researchLabs == null) {
    return "no research labs"
  }

  roomResource.roomInfoAccessor.clearResearchLabs()

  return [
    "cleared research labs:",
    `- input: ${researchLabs.inputLab1}`,
    `- input: ${researchLabs.inputLab2}`,
    `- output: ${researchLabs.outputLabs}`,
  ].join("\n")
}

/** @throws */
function toggleAutoAttack(roomResource: OwnedRoomResource, args: string[]): string {
  const roomName = roomResource.room.name
  const listArguments = new ListArguments(args)
  const enabled = listArguments.boolean(0, "enabled").parse()

  const describeBoolean = (flag: boolean): string => {
    return flag === true ? "enabled" : "disabled"
  }

  if (enabled === roomResource.roomInfoAccessor.config.enableAutoAttack) {
    return `already ${describeBoolean(enabled)}`
  }

  roomResource.roomInfoAccessor.config.enableAutoAttack = enabled

  if (enabled === true) {
    OperatingSystem.os.addProcess(null, processId => {
      return World35587255ScoutRoomProcess.create(processId, roomName)
    })
  } else {
    const scoutRoomProcessInfo = OperatingSystem.os.listAllProcesses().find(processInfo => {
      if (!(processInfo.process instanceof World35587255ScoutRoomProcess)) {
        return false
      }
      if (processInfo.process.parentRoomName !== roomName) {
        return false
      }
      return true
    })
    if (scoutRoomProcessInfo != null) {
      OperatingSystem.os.killProcess(scoutRoomProcessInfo.processId)
    }
  }

  return describeBoolean(enabled)
}

/** @throws */
function remote(roomResource: OwnedRoomResource, args: string[]): string {
  const descriptions: string[] = [
    `Room ${roomLink(roomResource.room.name)}:`,
  ]

    ;
  (strictEntries(roomResource.roomInfo.remoteRoomInfo) as [RoomName, RemoteRoomInfo][]).forEach(([roomName, roomInfo]) => {
    descriptions.join(`- ${roomLink(roomName)} enabled: ${roomInfo.enabled}, constructionFinished: ${roomInfo.constructionFinished}`)
  })

  return descriptions.join("\n")
}

/** @throws */
function toggleRemoteRoom(roomResource: OwnedRoomResource, args: string[]): string {
  const listArguments = new ListArguments(args)
  const remoteRoomNames = listArguments.list(0, "remote room names", "room_name").parse()
  const enabled = listArguments.boolean(1, "enabled").parse()

  const inexistenceRoomNames = remoteRoomNames.filter(remoteRoomName => {
    if (roomResource.roomInfo.remoteRoomInfo[remoteRoomName] == null) {
      return true
    }
    return false
  })

  if (inexistenceRoomNames.length > 0) {
    throw `${inexistenceRoomNames.map(roomName => roomLink(roomName)).join(",")} are not ${roomLink(roomResource.room.name)} remote`
  }

  remoteRoomNames.forEach(remoteRoomName => {
    const remoteRoomInfo = roomResource.roomInfo.remoteRoomInfo[remoteRoomName]
    if (remoteRoomInfo == null) {
      return
    }
    if (remoteRoomInfo.enabled !== true && enabled === true) {
      remoteRoomInfo.routeCalculatedTimestamp = {}
    }
    remoteRoomInfo.enabled = enabled
  })

  const booleanDescription = enabled === true ? "enabled" : "disabled"
  return `${booleanDescription} ${remoteRoomNames.map(roomName => roomLink(roomName)).join(",")}`
}

/** @throws */
function changeRoomType(roomResource: OwnedRoomResource, args: string[]): string {
  const listArguments = new ListArguments(args)
  const roomType = listArguments.typedString(0, "owned room type", "OwnedRoomType", isOwnedRoomTypes).parse()

  const oldValue = roomResource.roomInfo.ownedRoomType.case
  roomResource.roomInfo.ownedRoomType = {
    case: roomType,
  }

  return `changed to ${roomType} (from: ${oldValue})`
}

const boostCommandActions = [
  "add",
  "remove",
  "show",
] as const
type BoostCommandAction = typeof boostCommandActions[number]
function isBoostCommandAction(arg: string): arg is BoostCommandAction {
  if ((boostCommandActions as (readonly string[])).includes(arg) === true) {
    return true
  }
  return false
}

/**
 * 標準入力から呼び出された場合はエンコード処理より後に実行されるため
 * Configは参照を直接保持しているために保存処理が不要？
 */
function saveRoomInfo(roomName: RoomName, roomInfo: OwnedRoomInfo): void {
  Memory.v6RoomInfo[roomName] = roomInfo
}

/** @throws */
function boosts(roomResource: OwnedRoomResource, args: string[]): string {
  const roomName = roomResource.room.name
  const listArguments = new ListArguments(args)
  const action = listArguments.typedString(0, "action", "BoostCommandAction", isBoostCommandAction).parse()

  switch (action) {
  case "add": {
    const boost = listArguments.boostCompoundType(1, "boost").parse()

    return ((): string => {
      const boostInfo = new Map<MineralBoostConstant, number>()
      boostInfo.set(boost, 0)

      const result = roomResource.roomInfoAccessor.addBoosts(boostInfo)
      switch (result.resultType) {
      case "succeeded": {
        const successMessages: string[] = [
          ...result.value.newBoostLabs.map(labInfo => `- ${coloredResourceType(labInfo.boost)}: ${labInfo.labId}`)
        ]
        if (result.value.removedFromResearchOutputLabs.length > 0) {
          successMessages.push("removed from research outputs:")
          successMessages.push(...result.value.removedFromResearchOutputLabs.map(lab => `- ${lab.id} (${lab.pos})`))
        }

        saveRoomInfo(roomName, roomResource.roomInfo)

        return successMessages.join("\n")
      }
      case "failed":
        throw result.reason
      }
    })()
  }

  case "remove":
    return ((): string => {
      const boost = ((): MineralBoostConstant | "all" => {
        const arg = listArguments.string(1, "boost").parse()
        if (isMineralBoostConstant(arg)) {
          return arg
        }
        if (arg === "all") {
          return arg
        }
        throw `boost argument should be either MineralBoostConstant or "all" (${arg} given)`
      })()

      if (boost === "all") {
        const { addedToResearchOutputLabIds, removedBoosts } = roomResource.roomInfoAccessor.removeAllBoosts()
        const results: string[] = [
          `removed ${removedBoosts.map(boost => coloredResourceType(boost)).join(",")}`,
        ]
        if (addedToResearchOutputLabIds.length > 0) {
          results.push("added to research outputs:")
          results.push(...addedToResearchOutputLabIds.map(labId => `- ${labId}`))
        }

        saveRoomInfo(roomName, roomResource.roomInfo)
        return results.join("\n")
      }

      const results: string[] = [
        `removed ${coloredResourceType(boost)}`
      ]
      const result = roomResource.roomInfoAccessor.removeBoosts([boost])
      switch (result.resultType) {
      case "succeeded": {
        const { addedToResearchOutputLabIds } = result.value
        if (addedToResearchOutputLabIds.length > 0) {
          results.push("added to research outputs:")
          results.push(...addedToResearchOutputLabIds.map(labId => `- ${labId}`))
        }

        saveRoomInfo(roomName, roomResource.roomInfo)
        return results.join("\n")
      }

      case "failed":
        throw result.reason
      }
    })()

  case "show":
    return roomResource.roomInfoAccessor.boostLabs.map(labInfo => coloredResourceType(labInfo.boost)).join(", ")
  }
}

/** @throws */
function accessNumberProperty(command: NumberAccessorCommands, roomResource: OwnedRoomResource, args: string[]): string {
  const listArguments = new ListArguments(args)
  const action = listArguments.string(0, "action").parse()

  switch (action) {
  case "set": {
    const value = listArguments.int(1, "value").parse()
    switch (command) {
    case "mineral_max_amount":
      roomResource.roomInfoAccessor.config.mineralMaxAmount = value
      break
    case "construction_interval":
      roomResource.roomInfoAccessor.config.constructionInterval = value
      break
    case "concurrent_construction_site_count":
      roomResource.roomInfoAccessor.config.concurrentConstructionSites = value
      break
    case "wall_max_hits":
      roomResource.roomInfoAccessor.config.wallMaxHits = value
      break
    }
    return `set ${command} ${shortenedNumber(value)} for ${roomLink(roomResource.room.name)}`
  }
  case "get": {
    const value = ((): number => {
      switch (command) {
      case "mineral_max_amount":
        return roomResource.roomInfoAccessor.config.mineralMaxAmount
      case "construction_interval":
        return roomResource.roomInfoAccessor.config.constructionInterval
      case "concurrent_construction_site_count":
        return roomResource.roomInfoAccessor.config.concurrentConstructionSites
      case "wall_max_hits":
        return roomResource.roomInfoAccessor.config.wallMaxHits
      }
    })()
    return `${command} ${shortenedNumber(value)} for ${roomLink(roomResource.room.name)}`
  }
  default:
    throw `Invalid action ${action}, set "set" or "get"`
  }
}

/** @throws */
function powers(roomResource: OwnedRoomResource, args: string[]): string {
  const listArguments = new ListArguments(args)
  const action = listArguments.string(0, "action").parse()

  switch (action) {
  case "show": {
    const powers = roomResource.roomInfoAccessor.config.enabledPowers()
    if (powers.length <= 0) {
      return `no powers enabled in ${roomLink(roomResource.room.name)}`
    }
    return `${roomLink(roomResource.room.name)} has ${powers.map(power => `${powerName(power)}(${power})`).join(", ")}`
  }

  case "add": {
    const power = listArguments.powerType(1, "power").parse()
    roomResource.roomInfoAccessor.config.enablePower(power)
    return `${powerName(power)}(${power}) is enabled in ${roomLink(roomResource.room.name)}`
  }

  case "remove": {
    const power = listArguments.powerType(1, "power").parse()
    roomResource.roomInfoAccessor.config.disablePower(power)
    return `${powerName(power)}(${power}) is disabled in ${roomLink(roomResource.room.name)}`
  }

  default:
    throw `Invalid action ${action}, actions: show, add, remove`
  }
}

/** @throws */
function waitingPosition(roomResource: OwnedRoomResource, args: string[]): string {
  const listArguments = new ListArguments(args)
  const action = listArguments.string(0, "action").parse()

  switch (action) {
  case "set": {
    const positions = listArguments.localPositions(1, "waiting positions").parse()
    roomResource.roomInfoAccessor.config.addGenericWaitingPositions(positions)
    return `positions ${positions.map(position => `(${describePosition(position)})`).join(", ")} set`
  }

  case "show": {
    const waitingPositions = roomResource.roomInfoAccessor.config.getAllWaitingPositions()
    if (waitingPositions.length <= 0) {
      return "no waiting positions"
    }
    return waitingPositions.map(position => `${position}`).join(", ")
  }

  case "clear": {
    const waitingPositions = roomResource.roomInfoAccessor.config.getAllWaitingPositions()
    if (waitingPositions.length <= 0) {
      return "no waiting positions"
    }
    const oldValue = waitingPositions.map(position => `${position}`).join(", ")

    roomResource.roomInfoAccessor.config.clearWaitingPositions()
    return `Cleared ${oldValue}`
  }

  default:
    throw `Invalid action ${action}, actions: set, show, clear`
  }
}

// ---- Old Commands ---- //
/** @throws */
function refreshResearchLabs(roomName: RoomName, roomResource: OwnedRoomResource, args: Map<string, string>): string {
  const room = roomResource.room
  const roomInfo = roomResource.roomInfo
  if (roomInfo.researchLab == null) {
    roomInfo.researchLab = setResearchLabs(room, roomInfo, args)
  }

  const inputLabs = ((): StructureLab[] => {
    const lab1 = Game.getObjectById(roomInfo.researchLab.inputLab1)
    const lab2 = Game.getObjectById(roomInfo.researchLab.inputLab2)
    if (lab1 == null || lab2 == null) {
      const errorMessage = `input lab ${roomInfo.researchLab.inputLab1} and/or ${roomInfo.researchLab.inputLab2} is missing`
      roomInfo.researchLab = undefined
      throw errorMessage
    }
    return [lab1, lab2]
  })()

  const labIdsInRoom = (room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LAB } }) as StructureLab[])
    .map(lab => lab.id)

  const researchLabIds: Id<StructureLab>[] = [
    roomInfo.researchLab.inputLab1,
    roomInfo.researchLab.inputLab2,
    ...roomInfo.researchLab.outputLabs,
  ]

  try {
    researchLabIds.forEach(researchLabId => {
      const index = labIdsInRoom.indexOf(researchLabId)
      if (index < 0) {
        const labInstance = Game.getObjectById(researchLabId)
        if (labInstance == null) {
          throw `lab with ID ${researchLabId} not found in ${roomLink(roomName)}`
        }
        throw `lab ${labInstance} ${labInstance.pos} is not located in ${roomLink(roomName)} or iterated twice`
      }
      labIdsInRoom.splice(index, 1)
    })
  } catch (error) {
    roomInfo.researchLab = undefined

    throw `research lab iteration failed: ${error}\nreset research lab IDs in Memory`
  }

  const boostLabIds = roomResource.roomInfoAccessor.getBoostLabs().map(labInfo => labInfo.labId)
  if (boostLabIds != null) {
    boostLabIds.forEach(boostLabId => {
      const index = labIdsInRoom.indexOf(boostLabId)
      if (index >= 0) {
        labIdsInRoom.splice(index, 1)
      }
    })
  }

  if (labIdsInRoom.length <= 0) {
    return `no unused lab in ${roomLink(roomName)}, ${boostLabIds?.length ?? 0} boost labs and ${researchLabIds.length} research labs`
  }

  const addedOutputLabIds = labIdsInRoom.filter(labId => {
    const lab = Game.getObjectById(labId)
    if (lab == null) {
      return false
    }
    if (inputLabs.some(inputLab => inputLab.pos.getRangeTo(lab.pos) > 2) === true) {
      return false
    }
    return true
  })

  roomInfo.researchLab.outputLabs.push(
    ...addedOutputLabIds
  )

  return `${addedOutputLabIds.length} labs added to research output labs`
}

//** throws */
function setResearchLabs(room: Room, roomInfo: OwnedRoomInfo, args: Map<string, string>): { inputLab1: Id < StructureLab >, inputLab2: Id < StructureLab >, outputLabs: Id < StructureLab > [] } {
  const keywardArguments = new KeywordArguments(args)
  const missingArgumentErrorMessage = `no roomInfo.researchLab for ${roomLink(room.name)} set input_lab_id_1 and input_lab_id_2`
  const inputLab1Id = keywardArguments.gameObjectId("input_lab_id_1", { missingArgumentErrorMessage }).parse() as Id<StructureLab>
  const inputLab2Id = keywardArguments.gameObjectId("input_lab_id_2", { missingArgumentErrorMessage }).parse() as Id<StructureLab>
  if(inputLab1Id === inputLab2Id) {
    throw `input_lab_id_1 and input_lab_id_2 has the same value ${inputLab1Id}`
  }

  const validateLabId = (labId: Id<StructureLab>, key: string): void => {
    const lab = Game.getObjectById(labId)
    if (!(lab instanceof StructureLab)) {
      throw `ID for ${key} is not a lab (${lab})`
    }
  }

  validateLabId(inputLab1Id, "input_lab_id_1")
  validateLabId(inputLab2Id, "input_lab_id_2")

  return {
    inputLab1: inputLab1Id,
    inputLab2: inputLab2Id,
    outputLabs: [],
  }
}

function configureWallPositions(roomName: RoomName, roomInfo: OwnedRoomInfo, args: Map<string, string>): string {
  const roomPlan = roomInfo.roomPlan
  if(roomPlan == null) {
    return `${roomLink(roomName)} doesn't have room plan`
  }

  const action = args.get("action")
  if (action == null) {
    return missingArgumentError("action")
  }
  switch (action) {
  case "remove":
    roomPlan.wallPositions = undefined
    return "wall positions removed"
  case "set_it_done":
    roomPlan.wallPositions = []
    return "ok"
  default:
    return `Invalid action ${action}`
  }
}

function missingArgumentError(argumentName: string): string {
  return `Missing ${argumentName} argument`
}

function parseProcessArguments(args: string[]): Map < string, string > {
  const result = new Map<string, string>()
  args.forEach(arg => {
    const [key, value] = arg.split("=")
    if (key == null || value == null) {
      return
    }
    result.set(key, value)
  })
  return result
}
