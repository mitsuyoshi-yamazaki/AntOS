import { Command, runCommands } from "os_v5/standard_io/command"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { RoomModule } from "os_v5/processes/game_object_management/room/room_planner/room_module/room_module"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { describePosition, Position } from "shared/utility/position_v2"
import { SourceLinkSourceLayout } from "os_v5/processes/game_object_management/room/room_planner/room_module/modules"
import { SharedMemory } from "os_v5/system_calls/process_manager/shared_memory"
import { processDefaultIdentifier } from "os_v5/process/process"
import { AssignedPositions, CreepPositionAssignerProcessApi } from "@private/os_v5/processes/game_object_management/creep/creep_position_assigner_process"


export const RoomModuleTestCommand: Command = {
  command: "room_module",

  help(): string {
    return "room_module {module type} {...args}"
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string {
    return runCommands(argumentParser, [
      SourceLinkTestCommand,
    ])
  },
}


const SourceLinkTestCommand: Command = {
  command: "SourceLink",

  help(): string {
    return "SourceLink {room name}"
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string {
    const room = argumentParser.room([0, "room name"]).parse()
    const module = RoomModule.Modules.SourceLink.create()

    if (module.checkPrecondition(room) !== true) {
      return `Room ${ConsoleUtility.roomLink(room.name)} is not claimable`
    }

    const sources = room.find(FIND_SOURCES)
    const api = SharedMemory.get<CreepPositionAssignerProcessApi>("CreepPositionAssignerProcess", processDefaultIdentifier)
    if (api == null) {
      throw "No CreepPositionAssignerProcess"
    }

    let assigns: AssignedPositions[] = []
    const layouts: SourceLinkSourceLayout[] = []
    const structures: [BuildableStructureConstant, Position][] = []
    const errors: string[] = []

    sources.forEach(source => {
      const result = module.make(source, api, assigns)
      if (result == null) {
        errors.push(`Failed to make layout for source at ${describePosition(source.pos)} in ${ConsoleUtility.roomLink(source.room.name)}`)
        return
      }
      layouts.push(result.layout)
      assigns = result.assigns

      structures.push([STRUCTURE_CONTAINER, result.layout.harvesterPosition])
      structures.push([STRUCTURE_LINK, result.layout.linkPosition])
    })

    draw(room, structures)

    if (layouts.length <= 0) {
      if (sources.length <= 0) {
        throw `No sources in ${ConsoleUtility.roomLink(room.name)}`
      }
      if (errors.length > 0) {
        throw `Failed to make layouts:\n${errors.join("\n")}`
      }
      throw "Something wrong"
    }

    const results: string[] = [
      "- Layouts made:",
      ...layouts.map(layout => `  - ${layout.sourceId}`),
    ]

    if (errors.length > 0) {
      results.push("- Errors:")
      results.push(...errors.map(error => `  - ${error}`))
    }

    return results.join("\n")
  },
}


// Utility
const draw = (room: Room, structures: [BuildableStructureConstant, Position][]): void => {
  const style: TextStyle = {
    color: "red",
  }
  structures.forEach(([structureType, position]) => {
    room.visual.text(structureType[0]?.toUpperCase() ?? "", position.x, position.y, style)
  })
}
