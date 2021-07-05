import { TaskRunner } from "objective/task_runner"
import { OwnedRoomObjects } from "world_info/room_info"

export class CreateConstructionSiteTaskRunner implements TaskRunner {
  public constructor(
    public readonly objects: OwnedRoomObjects,
  ) {
  }

  public run(): void {
    if (this.objects.constructionSites.length > 0) {
      return
    }
    if (Game.time % 17 !== 3) {
      return
    }
    this.placeConstructionSite(this.objects.controller.room, this.objects.flags)
  }

  private placeConstructionSite(room: Room, flags: Flag[]): void {
    const colorMap = new Map<ColorConstant, StructureConstant>([
      [COLOR_BROWN, STRUCTURE_ROAD],
      [COLOR_GREEN, STRUCTURE_STORAGE],
      [COLOR_PURPLE, STRUCTURE_TERMINAL],
      [COLOR_ORANGE, STRUCTURE_LINK],
      [COLOR_BLUE, STRUCTURE_LAB],
      [COLOR_RED, STRUCTURE_TOWER],
      [COLOR_GREY, STRUCTURE_SPAWN],
      [COLOR_CYAN, STRUCTURE_NUKER],
      [COLOR_WHITE, STRUCTURE_EXTENSION],
    ])

    for (const flag of flags) {
      const structureType = colorMap.get(flag.color)
      if (structureType == null) {
        continue
      }
      const result = room.createConstructionSite(flag.pos, structureType)
      switch (result) {
      case OK:
        flag.remove()
        return
      case ERR_NOT_OWNER:
      case ERR_INVALID_TARGET:
      case ERR_INVALID_ARGS:
        flag.remove()
        break
      case ERR_FULL:
      case ERR_RCL_NOT_ENOUGH:
        break
      }
    }
  }
}
