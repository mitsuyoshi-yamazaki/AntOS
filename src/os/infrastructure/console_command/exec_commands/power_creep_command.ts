import { roomLink } from "utility/log"
import { KeywordArguments } from "../../../../shared/utility/argument_parser/keyword_argument_parser"
import { ListArguments } from "../../../../shared/utility/argument_parser/list_argument_parser"

/** @throws */
export function execPowerCreepCommand(powerCreep: PowerCreep, args: string[]): string {
  const commandList = ["help", "spawn"]
  const listArguments = new ListArguments(args)
  const keywordArguments = new KeywordArguments(args)

  const command = listArguments.string(0, "command").parse()
  switch (command) {
  case "help":
    return `Commands: ${commandList}`
  case "spawn":
    return spawnPowerCreep(powerCreep, keywordArguments)
  default:
    throw `Invalid command ${command}. see "help"`
  }
}

/** @throws */
function spawnPowerCreep(powerCreep: PowerCreep, keywordArguments: KeywordArguments): string {
  const roomResource = keywordArguments.ownedRoomResource("room_name").parse()
  const powerSpawn = roomResource.activeStructures.powerSpawn
  if (powerSpawn == null) {
    throw `no active power spawn in ${roomLink(roomResource.room.name)}`
  }

  const result = powerCreep.spawn(powerSpawn)
  switch (result) {
  case OK:
    return "ok"
  case ERR_NOT_OWNER:
  case ERR_BUSY:
  case ERR_INVALID_TARGET:
  case ERR_TIRED:
  case ERR_RCL_NOT_ENOUGH:
    throw `PowerCreep ${powerCreep.name} powerCreep.spawn() returns ${result}`
  }
}
