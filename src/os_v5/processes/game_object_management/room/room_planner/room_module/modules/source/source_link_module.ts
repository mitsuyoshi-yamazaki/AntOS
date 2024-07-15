import { AssignedPositions, CreepPositionAssignerProcessApi } from "@private/os_v5/processes/game_object_management/creep/creep_position_assigner_process"
import { Position } from "shared/utility/position_v2"
import { RoomModule, RoomModuleEncodingMap } from "../../types"

type Api = CreepPositionAssignerProcessApi
type Assigns = AssignedPositions[]

type SourceLinkState = {
  readonly t: RoomModuleEncodingMap["SourceLink"]
}

export type SourceLinkSourceLayout = {
  readonly sourceId: Id<Source>
  readonly harvesterPosition: Position
  readonly linkPosition: Position
}

export class SourceLink extends RoomModule<SourceLinkState, Source, Api, Assigns, SourceLinkSourceLayout> {
  private constructor(
  ) {
    super()
  }

  public encode(): SourceLinkState {
    return {
      t: "a",
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static decode(state: SourceLinkState): SourceLink {
    return new SourceLink()
  }

  public static create(): SourceLink {
    return new SourceLink()
  }

  public checkPrecondition(room: Room): boolean {
    if (room.controller == null) {
      return false
    }
    return true
  }

  public make(source: Source, api: Api, assigns: Assigns): { layout: SourceLinkSourceLayout, assigns: Assigns } | null {
    const sourcePosition = { x: source.pos.x, y: source.pos.y } as Position

    const harvesterResult = api.addVirtualAssign(sourcePosition, 1, 1, source.room, assigns)
    if (harvesterResult.case !== "succeeded") {
      return null
    }

    const harvesterAssignId = harvesterResult.value.assign.id
    const harvesterPositions = harvesterResult.value.assigns.find(assignObject => assignObject.assign.id === harvesterAssignId)?.assignedPositions ?? []
    const harvesterPosition = harvesterPositions[0]
    if (harvesterPosition == null) {
      return null
    }

    const linkResult = api.addVirtualAssign(harvesterPosition, 1, 1, source.room, harvesterResult.value.assigns)
    if (linkResult.case !== "succeeded") {
      return null
    }

    const linkAssignId = linkResult.value.assign.id
    const linkPositions = linkResult.value.assigns.find(assignObject => assignObject.assign.id === linkAssignId)?.assignedPositions ?? []
    const linkPosition = linkPositions[0]
    if (linkPosition == null) {
      return null
    }

    return {
      layout: {
        sourceId: source.id,
        harvesterPosition,
        linkPosition,
      },
      assigns: linkResult.value.assigns,
    }
  }
}
