import { OperatingSystem } from "os/os"
import { BoostLabChargerProcess } from "process/process/boost_lab_charger_process"
import { describePosition } from "prototype/room_position"
import { isOwnedRoomTypes, OwnedRoomInfo } from "room_resource/room_info"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { powerName } from "utility/power"
import { isMineralBoostConstant, isMineralCompoundConstant } from "utility/resource"
import { isRoomName, RoomName } from "utility/room_name"
import { KeywordArguments } from "../utility/keyword_argument_parser"
import { ListArguments } from "../utility/list_argument_parser"

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
  const oldCommandList = ["excluded_remotes", "wall_positions", "research_compounds", "refresh_research_labs", "toggle_auto_attack"]
  const commandList: string[] = [
    "help",
    "waiting_position",
    "powers",
    "boosts",
    "set_remote_room_path_cache_enabled",
    "change_room_type",
    "toggle_remote",
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
  case "mineral_max_amount":
  case "construction_interval":
  case "concurrent_construction_site_count":
  case "wall_max_hits":
    return accessNumberProperty(command, roomResource, args)

    // ---- Old Commands ---- //
  case "excluded_remotes":
    return addExcludedRemoteRoom(roomName, roomInfo, parseProcessArguments(args))
  case "wall_positions":
    return configureWallPositions(roomName, roomInfo, parseProcessArguments(args))
  case "research_compounds":
    return configureResearchCompounds(roomName, roomInfo, parseProcessArguments(args))
  case "refresh_research_labs":
    return refreshResearchLabs(roomName, roomResource, parseProcessArguments(args))
  // case "disable_boost_labs": // TODO: 消す
  //   return disableBoostLabs(roomName, roomInfo)
  case "toggle_auto_attack":
    return toggleAutoAttack(roomName, roomInfo, parseProcessArguments(args))
  default:
    throw `Invalid command ${command}, see "help"`
  }
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
    const process = ((): BoostLabChargerProcess => {
      const runningProcess = labChargerProcessFor(roomName)
      if (runningProcess != null) {
        return runningProcess
      }
      return OperatingSystem.os.addProcess(null, processId => BoostLabChargerProcess.create(processId, roomName))
    })()

    return ((): string => {
      const result = roomResource.roomInfoAccessor.addBoosts([boost])
      switch (result.resultType) {
      case "succeeded": {
        const successMessages: string[] = [
          `added ${coloredResourceType(boost)}, process: ${process.constructor.name} ${process.processId}`,
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

  case "remove": {
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
  }
  }
}

function labChargerProcessFor(roomName: RoomName): BoostLabChargerProcess | null {
  for (const processInfo of OperatingSystem.os.listAllProcesses()) {
    const process = processInfo.process
    if (!(process instanceof BoostLabChargerProcess)) {
      continue
    }
    if (process.parentRoomName !== roomName) {
      continue
    }
    return process
  }
  return null
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
    return `set ${command} ${value} for ${roomLink(roomResource.room.name)}`
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
    return `${command} ${value} for ${roomLink(roomResource.room.name)}`
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

  default:
    throw `Invalid action ${action}, actions: set, show`
  }
}

// ---- Old Commands ---- //
function toggleAutoAttack(roomName: RoomName, roomInfo: OwnedRoomInfo, args: Map<string, string>): string {
  const rawEnabled = args.get("enabled")
  if(rawEnabled == null) {
    return missingArgumentError("enabled")
  }
  if (rawEnabled !== "0" && rawEnabled !== "1") {
    return `Invalid enable argument ${rawEnabled}: set 0 or 1`
  }
  const enabled = rawEnabled === "1"

  if (roomInfo.config == null) {
    roomInfo.config = {}
  }
  const oldValue = roomInfo.config.enableAutoAttack
  roomInfo.config.enableAutoAttack = enabled

  return `${roomLink(roomName)} auto attack set ${oldValue} => ${enabled}`
}

/** throws */
function refreshResearchLabs(roomName: RoomName, roomResource: OwnedRoomResource, args: Map<string, string>): string {
  const room = roomResource.room
  const roomInfo = roomResource.roomInfo
  if (roomInfo.researchLab == null) {
    roomInfo.researchLab = setResearchLabs(room, roomInfo, args)
  }

  const labIdsInRoom = (room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LAB } }) as StructureLab[])
    .map(lab => lab.id)

  const researchLabIds: Id<StructureLab>[] = [
    roomInfo.researchLab.inputLab1,
    roomInfo.researchLab.inputLab2,
    ...roomInfo.researchLab.outputLabs,
  ]
  researchLabIds.forEach(researchLabId => {
    const index = labIdsInRoom.indexOf(researchLabId)
    if (index >= 0) {
      labIdsInRoom.splice(index, 1)
    }
  })

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
  roomInfo.researchLab.outputLabs.push(...labIdsInRoom)

  return `${labIdsInRoom.length} labs added to research output labs`
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

function configureResearchCompounds(roomName: RoomName, roomInfo: OwnedRoomInfo, args: Map<string, string>): string {
  const getCompoundSetting = (): [MineralCompoundConstant, number] | string => {
    const compoundType = args.get("compound")
    if (compoundType == null) {
      return missingArgumentError("compound")
    }
    if (!isMineralCompoundConstant(compoundType)) {
      return `${compoundType} is not valid mineral compound type`
    }
    const rawAmount = args.get("amount")
    if (rawAmount == null) {
      return missingArgumentError("amount")
    }
    const amount = parseInt(rawAmount, 10)
    if (isNaN(amount) === true) {
      return `amount is not a number ${rawAmount}`
    }
    return [
      compoundType,
      amount
    ]
  }

  const action = args.get("action")
  if(action == null) {
    return missingArgumentError("action")
  }

  const getResearchCompounds = (): { [index in MineralCompoundConstant]?: number } => {
    if (roomInfo.config == null) {
      roomInfo.config = {}
    }
    if (roomInfo.config.researchCompounds == null) {
      roomInfo.config.researchCompounds = {}
    }
    return roomInfo.config.researchCompounds
  }

  const getCurentsettings = (): string => {
    const entries = Object.entries(getResearchCompounds())
    if (entries.length <= 0) {
      return "no research compounds"
    }
    return entries
      .map(([compoundType, amount]) => `\n- ${coloredResourceType(compoundType as MineralCompoundConstant)}: ${amount}`)
      .join("")
  }

  switch (action) {
  case "show":
    return getCurentsettings()
  case "clear": {
    const currentSettings = getCurentsettings()
    if (roomInfo.config == null) {
      roomInfo.config = {}
    }
    roomInfo.config.researchCompounds = {}
    return `${coloredText("cleared", "info")}: ${currentSettings}`
  }
  case "add": {
    const settings = getCompoundSetting()
    if (typeof settings === "string") {
      return settings
    }
    const researchCompounds = getResearchCompounds()
    researchCompounds[settings[0]] = settings[1]
    return `${coloredText("added", "info")} ${coloredResourceType(settings[0])}: ${getCurentsettings()}`
  }
  default:
    return `Invalid action ${action}`
  }
}

function addExcludedRemoteRoom(roomName: RoomName, roomInfo: OwnedRoomInfo, args: Map<string, string>): string {
  const remoteRoomName = args.get("remote_room_name")
  if(remoteRoomName == null) {
    return missingArgumentError("remote_room_name")
  }
  if (!isRoomName(remoteRoomName)) {
    return `Invalid remote_room_name ${remoteRoomName}`
  }
  if (roomInfo.config == null) {
    roomInfo.config = {}
  }
  if (roomInfo.config.excludedRemotes == null) {
    roomInfo.config.excludedRemotes = []
  }
  if (roomInfo.config.excludedRemotes.includes(remoteRoomName) === true) {
    return `${roomLink(remoteRoomName)} is already excluded`
  }
  roomInfo.config.excludedRemotes.push(remoteRoomName)
  return `${roomLink(remoteRoomName)} is added to excluded list in ${roomLink(roomName)}`
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
