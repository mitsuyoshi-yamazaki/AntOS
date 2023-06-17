/**
 # OwnedRoomResource
 ## 概要
 Room内の事象を統一的に扱うクラス

 # StructureObject
 ## 概要
 Structureを仮想資源化し状態管理を行う型

 # Discussion
 - ActiveStructureのtypeを作ったらどうか
 */

import { } from "./buildable_structure"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { PrimitiveLogger } from "v8/operating_system/primitive_logger"

const roomLink = ConsoleUtility.roomLink

export class OwnedRoomResource {
  public readonly activeStructures: {
    // spawns: StructureSpawn[]
    // extensions: StructureExtension[]
    // towers: StructureTower[]
    // storage: StructureStorage | null
    // terminal: StructureTerminal | null
    // extractor: StructureExtractor | null
    // observer: StructureObserver | null
    // powerSpawn: StructurePowerSpawn | null
    // factory: StructureFactory | null
  }

  public constructor(
    public readonly room: Room
  ) {
    room.getEventLog().forEach(eventItem => {
      const eventType = eventItem.event
      switch (eventType) {
      case EVENT_ATTACK:
      case EVENT_OBJECT_DESTROYED:
      case EVENT_BUILD:
      case EVENT_HEAL:
      case EVENT_REPAIR:
      case EVENT_POWER:
      case EVENT_EXIT:
      case EVENT_RESERVE_CONTROLLER:
        // nothing to do
        break

      case EVENT_HARVEST:
      case EVENT_UPGRADE_CONTROLLER:
      case EVENT_TRANSFER:
      case EVENT_ATTACK_CONTROLLER:
        // not implemented yet
        break

      default: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _: never = eventType
        PrimitiveLogger.programError(`OwnedRoomResource unrecognized event ${eventType} in ${roomLink(room.name)}`)
        break
      }
      }
    })

    this.activeStructures = {
    }
  }
}
