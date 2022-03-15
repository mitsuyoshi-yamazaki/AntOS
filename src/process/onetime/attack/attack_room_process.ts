import { processLog } from "os/infrastructure/logger"
import { MessageObserver } from "os/infrastructure/message_observer"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { OperatingSystem } from "os/os"
import { Process, ProcessId } from "process/process"
import { ProcessDecoder } from "process/process_decoder"
import { ProcessState } from "process/process_state"
import { Position } from "prototype/room_position"
import { GameConstants } from "utility/constants"
import { CreepBody } from "utility/creep_body"
import { describeTime, roomLink } from "utility/log"
import { RoomName } from "utility/room_name"
import { Timestamp } from "utility/timestamp"
import { QuadCreepSpec } from "../../../../submodules/private/attack/quad/quad_spec"
import { QuadMaker, QuadMakerState } from "../quad_maker/quad_maker"

ProcessDecoder.register("AttackRoomProcess", state => {
  return AttackRoomProcess.decode(state as AttackRoomProcessState)
})

type AttackPlanNone = {
  readonly case: "none"
  readonly reason: string
}
type AttackPlanSingleQuad = {
  readonly case: "single_quad"
  readonly quadMakerState: QuadMakerState
}
type AttackPlan = AttackPlanNone | AttackPlanSingleQuad

type TargetStructure<T extends Structure<BuildableStructureConstant>> = {
  readonly id: Id<T>
  readonly position: Position
  readonly rampartHits: number
}

type Bunker = {
  readonly towers: TargetStructure<StructureTower>[]
  readonly spawns: TargetStructure<StructureSpawn>[]
  readonly targetWalls: TargetStructure<StructureWall | StructureRampart>[]
}
type TargetRoomPlan = {
  readonly calculatedAt: Timestamp
  readonly bunkers: Bunker[]
  readonly attackPlan: AttackPlan
}

type ObserveRecord = {
  readonly owner: Owner | null
  readonly safemodeEndsAt: number | null
  readonly observedAt: number
  roomPlan: TargetRoomPlan | null
}

type TargetRoomInfo = {
  readonly roomName: RoomName
  observeRecord: ObserveRecord | null
}

type CreepKilledLog = {
  case: "creep killed"
  bodyDescription: string
}
type HostileCreepKilledLog = {
  case: "hostile creep killed"
  bodyDescription: string
}
type HostileStructureDestroyedLog = {
  case: "hostile structure destroyed"
  structureType: StructureConstant
}
type Log = CreepKilledLog | HostileCreepKilledLog | HostileStructureDestroyedLog

interface AttackRoomProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetRoomInfo: TargetRoomInfo
  readonly resourceSpent: { [resourceType: string]: number }
  readonly logs: Log[]
}

export class AttackRoomProcess implements Process, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly targetRoomInfo: TargetRoomInfo,
    private readonly resourceSpent: { [resourceType: string]: number },
    private readonly logs: Log[],
  ) {
    this.identifier = `${this.constructor.name}`
  }

  public encode(): AttackRoomProcessState {
    return {
      t: "AttackRoomProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetRoomInfo: this.targetRoomInfo,
      resourceSpent: this.resourceSpent,
      logs: this.logs,
    }
  }

  public static decode(state: AttackRoomProcessState): AttackRoomProcess {
    return new AttackRoomProcess(state.l, state.i, state.roomName, state.targetRoomInfo, state.resourceSpent, state.logs)
  }

  public static create(processId: ProcessId, roomName: RoomName, targetRoomName: RoomName): AttackRoomProcess {
    const targetRoomInfo: TargetRoomInfo = {
      roomName: targetRoomName,
      observeRecord: null,
    }

    return new AttackRoomProcess(Game.time, processId, roomName, targetRoomInfo, {}, [])
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "show_target_room_info", "erase_room_plan"]

    const components = message.split(" ")
    const command = components.shift()

    switch (command) {
    case "help":
      return `Commands: ${commandList}`

    case "show_target_room_info":
      return this.showTargetRoomInfo()

    case "erase_room_plan":
      if (this.targetRoomInfo.observeRecord == null) {
        return "not observed yet"
      }
      this.targetRoomInfo.observeRecord.roomPlan = null
      return "ok"

    default:
      return `Invalid command ${command}. "help" to show command list`
    }
  }

  private showTargetRoomInfo(): string {
    const targetRoomPlan = this.targetRoomInfo.observeRecord?.roomPlan
    if (targetRoomPlan == null) {
      return `${roomLink(this.targetRoomInfo.roomName)} no room plan`
    }

    const attackPlanDescription = ((): string => {
      const attackPlan = targetRoomPlan.attackPlan
      switch (attackPlan.case) {
      case "none":
        return `no attack plan: ${attackPlan.reason}`
      case "single_quad": {
        const quadMaker = QuadMaker.decode(attackPlan.quadMakerState)
        return `attack plan:\n${quadMaker.description()}`
      }
      }
    })()

    const info: string[] = [
      `calculated at ${describeTime(Game.time - targetRoomPlan.calculatedAt)} ago, ${targetRoomPlan.bunkers.length} bunkers`,
      ...targetRoomPlan.bunkers.map(bunker => `- ${bunker.towers.length} towers, ${bunker.spawns.length} spawns`),
      attackPlanDescription,
    ]
    return info.join("\n")
  }

  public runOnTick(): void {
    const targetRoom = Game.rooms[this.targetRoomInfo.roomName]
    if (targetRoom == null) {
      return  // constructionSaboteurProcessが動いているはず
    }
    if (targetRoom.controller == null || targetRoom.controller.owner == null) {
      PrimitiveLogger.notice(`${this.identifier} ${roomLink(this.targetRoomInfo.roomName)} is no longer occupied`)
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }

    const controller = targetRoom.controller
    const owner = targetRoom.controller.owner

    const safemodeEndsAt = ((): number | null => {
      if (controller.safeMode == null) {
        return null
      }
      return controller.safeMode + Game.time
    })()

    const targetRoomPlan = ((): TargetRoomPlan => {
      const storedPlan = this.targetRoomInfo.observeRecord?.roomPlan
      if (storedPlan != null) {
        if (Game.time - storedPlan.calculatedAt < 1000) {
          return storedPlan
        }
      }
      return this.calculateRoomPlan(targetRoom)
    })()

    const observeRecord: ObserveRecord = {
      owner,
      observedAt: Game.time,
      safemodeEndsAt,
      roomPlan: targetRoomPlan,
    }

    this.targetRoomInfo.observeRecord = observeRecord
  }

  private calculateRoomPlan(targetRoom: Room): TargetRoomPlan {
    processLog(this, `target room plan calculated ${roomLink(targetRoom.name)}`)

    // TODO: 複数bunkerの部屋を解釈できるようにする
    const bunker: Bunker = {
      towers: this.getStructure(STRUCTURE_TOWER, targetRoom) as TargetStructure<StructureTower>[],
      spawns: this.getStructure(STRUCTURE_SPAWN, targetRoom) as TargetStructure<StructureSpawn>[],
      targetWalls: [],  // TODO:
    }
    const bunkers: Bunker[] = [bunker]

    return {
      calculatedAt: Game.time,
      bunkers,
      attackPlan: this.calculateAttackPlanFor(bunkers),
    }
  }

  private getStructure<T extends BuildableStructureConstant>(structureType: T, room: Room): TargetStructure<Structure<T>>[] {
    const wallStructureTypes: StructureConstant[] = [STRUCTURE_WALL, STRUCTURE_RAMPART]
    const getRampartHits = (structure: Structure<T>): number => {
      if (wallStructureTypes.includes(structure.structureType) === true) {
        return structure.hits
      }
      const rampart = structure.pos.findInRange(FIND_HOSTILE_STRUCTURES, 0, { filter: { structureType: STRUCTURE_RAMPART } })[0]
      if (rampart == null) {
        return 0
      }
      return rampart.hits
    }

    const structures: Structure<T>[] = room.find<Structure<T>>(FIND_STRUCTURES, { filter: { structureType: structureType } })
    return structures.map((structure): TargetStructure<Structure<T>> => {
      return {
        id: structure.id,
        position: { x: structure.pos.x, y: structure.pos.y },
        rampartHits: getRampartHits(structure),
      }
    })
  }

  private calculateAttackPlanFor(bunkers: Bunker[]): AttackPlan {
    const towerCount = bunkers.reduce((count, bunker) => count + bunker.towers.length, 0)
    // const estimatedWallHitsToDestroyTowers = bunkers.reduce((hits, bunker) => {
    //   const wallHits = bunker.targetWalls.reduce((result, wall) => result + wall.rampartHits, 0)
    //   const towerRampartHits = bunker.towers.reduce((result, tower) => result + tower.rampartHits, 0)
    //   return hits + wallHits + towerRampartHits
    // }, 0)

    // TODO: 現状ではboostなし、RCL8想定、1Attacker,3Healer
    try {
      const bodyMaxLength = GameConstants.creep.body.bodyPartMaxCount
      const healerSpec = ((): QuadCreepSpec => {
        const requiredHealPower = towerCount * GameConstants.structure.tower.maxAttackPower
        const requiredHealCount = Math.ceil(requiredHealPower / GameConstants.creep.actionPower.heal)
        const healCount = Math.max(Math.ceil(requiredHealCount / 3), 4)

        const rangedAttackCount = (bodyMaxLength / 2) - healCount
        const moveCount = healCount + rangedAttackCount

        const body: BodyPartConstant[] = [
          ...Array(rangedAttackCount).fill(RANGED_ATTACK),
          ...Array(moveCount).fill(MOVE),
          ...Array(healCount).fill(HEAL),
        ]
        if (body.length > bodyMaxLength) {
          throw `required ${healCount}HEALs/creep (estimated body: ${CreepBody.description(body)})`
        }

        return {
          body,
        }
      })()

      const attackerSpec = ((): QuadCreepSpec => {
        const attackCount = bodyMaxLength / 2
        const moveCount = attackCount

        return {
          body: [
            ...Array(attackCount).fill(ATTACK),
            ...Array(moveCount).fill(MOVE),
          ],
        }
      })()

      const quadMaker = QuadMaker.create("auto", this.roomName, this.targetRoomInfo.roomName)
      quadMaker.boosts = []
      quadMaker.canHandleMelee = true
      quadMaker.creepSpecs = [
        ...Array(3).fill(healerSpec),
        attackerSpec,
      ]

      return {
        case: "single_quad",
        quadMakerState: quadMaker.encode(),
      }

    } catch (error) {
      return {
        case: "none",
        reason: `${error}`,
      }
    }
  }
}
