import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
import { coloredText, roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { SequentialTask, SequentialTaskOptions } from "v5_object_task/creep_task/combined_task/sequential_task"
import { EndlessTask } from "v5_object_task/creep_task/meta_task/endless_task"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { ProcessDecoder } from "process/process_decoder"
import { MessageObserver } from "os/infrastructure/message_observer"
import { OwnedRoomProcess } from "process/owned_room_process"
import { GameMap } from "game/game_map"
import { FleeFromTask } from "v5_object_task/creep_task/meta_task/flee_from_task"
import { StompTask } from "v5_object_task/creep_task/meta_task/stomp_task"
import { describePosition } from "prototype/room_position"
import { ListArguments } from "shared/utility/argument_parser/list_argument_parser"

ProcessDecoder.register("SaboteurConstructionProcess", state => {
  return SaboteurConstructionProcess.decode(state as SaboteurConstructionProcessState)
})

type Options = "attacker creep" // [MOVE] の代わりに [ATTACK, MOVE] を使用する
  | "keep spawning"  // safemodeに入っていてもcreepを送り続ける

type SignStatus = "unchecked" | "sign" | "done"
type ConstructionSiteInfo = {
  readonly constructionSite: ConstructionSite<BuildableStructureConstant>
  readonly priority: number
}
const targetPriority: BuildableStructureConstant[] = [  // 添字が大きい方が優先
  STRUCTURE_RAMPART,
  STRUCTURE_STORAGE,
  STRUCTURE_TERMINAL,
  STRUCTURE_SPAWN,
  STRUCTURE_TOWER,
]

export interface SaboteurConstructionProcessState extends ProcessState {
  /** parent room name */
  readonly p: RoomName

  /** target room name */
  readonly tr: RoomName

  /** number of creeps */
  readonly n: number

  readonly fleeRange: number
  readonly stopSpawning: boolean

  readonly options: Options[]
}

export class SaboteurConstructionProcess implements Process, Procedural, OwnedRoomProcess, MessageObserver {
  public get taskIdentifier(): string {
    return this.identifier
  }
  public get ownedRoomName(): RoomName {
    return this.parentRoomName
  }

  public readonly identifier: string

  private get estimatedTravelDistance(): number {
    if (this._estimatedTravelDistance == null) {
      this._estimatedTravelDistance = this.calculateTravelDistance()
    }
    return this._estimatedTravelDistance
  }

  private readonly codename: string
  private shouldSign = "unchecked" as SignStatus
  private _estimatedTravelDistance = null as number | null

  private get keepSpawning(): boolean {
    return this.options.has("keep spawning")
  }
  private set keepSpawning(keep: boolean) {
    if (keep === true) {
      this.options.add("keep spawning")
    } else {
      this.options.delete("keep spawning")
    }
  }

  private get useAttacker(): boolean {
    return this.options.has("attacker creep")
  }
  private set useAttacker(use: boolean) {
    if (use === true) {
      this.options.add("attacker creep")
    } else {
      this.options.delete("attacker creep")
    }
  }

  private halt = 0

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    private numberOfCreeps: number,
    private fleeRange: number,
    private stopSpawning: boolean,
    private readonly options: Set<Options>,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): SaboteurConstructionProcessState {
    return {
      t: "SaboteurConstructionProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
      n: this.numberOfCreeps,
      fleeRange: this.fleeRange,
      stopSpawning: this.stopSpawning,
      options: Array.from(this.options),
    }
  }

  public static decode(state: SaboteurConstructionProcessState): SaboteurConstructionProcess {
    return new SaboteurConstructionProcess(state.l, state.i, state.p, state.tr, state.n, state.fleeRange, state.stopSpawning, new Set<Options>(state.options ?? []))
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, creepCount: number): SaboteurConstructionProcess {
    return new SaboteurConstructionProcess(Game.time, processId, parentRoomName, targetRoomName, creepCount, 6, false, new Set<Options>([]))
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      roomLink(this.targetRoomName)
    ]
    if (this.stopSpawning === true) {
      descriptions.push("spawning stopped")
    }
    return descriptions.join(" ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "stop", "resume", "flee", "creep", "keep_spawning", "show_whereabouts", "use_attacker"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      if (command == null) {
        throw "empty message"
      }
      switch (command) {
      case "help":
        return `Commands: ${commandList}`
      case "stop":
        this.stopSpawning = true
        return "Spawning stopped"
      case "resume":
        this.stopSpawning = false
        return "Spawning resumed"
      case "flee": {
        const rawRange = components[0]
        if (rawRange == null) {
          return "No range argument"
        }
        const fleeRange = parseInt(rawRange, 10)
        if (isNaN(fleeRange) === true) {
          return `Invalid flee range ${rawRange}`
        }
        this.fleeRange = fleeRange
        return `Flee range ${fleeRange} set`
      }
      case "creep": {
        const rawCreeps = components[0]
        if (rawCreeps == null) {
          return "No range argument"
        }
        const numberOfCreeps = parseInt(rawCreeps, 10)
        if (isNaN(numberOfCreeps) === true) {
          return `Invalid creep count ${rawCreeps}`
        }
        this.numberOfCreeps = numberOfCreeps
        return `${numberOfCreeps} creeps set`
      }
      case "keep_spawning":
        this.keepSpawning = true
        return "keep spawn"
      case "show_whereabouts": {
        const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.taskIdentifier, () => true)
        if (creeps.length <= 0) {
          if (this.stopSpawning === true) {
            return "spawning stopped"
          }
          return "no creeps"
        }
        return creeps.map(creep => `${creep.name} in ${describePosition(creep.pos)} ${roomLink(creep.pos.roomName)}`).join(", ")
      }
      case "use_attacker": {
        const listArguments = new ListArguments(components)
        this.useAttacker = listArguments.boolean(0, "use attacker").parse()
        return `set ${this.useAttacker}`
      }
      default:
        throw `Invalid command ${command}, see "help"`
      }
    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  }

  public setKeepSpawning(): void {
    this.keepSpawning = true
  }

  public runOnTick(): void {
    ((): void => {
      const targetRoom = Game.rooms[this.targetRoomName]
      if (targetRoom?.controller == null) {
        return
      }
      if (targetRoom.controller.safeMode == null) {
        return
      }
      if (this.keepSpawning === true) {
        return
      }
      this.stopSpawning = true
    })()

    this.runScout()
  }

  private runScout(): void {
    this.halt -= 1  // Creepが部屋の端で停止するなどしないようにする

    const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)
    const insufficientCreepCount = this.numberOfCreeps - creeps.length
    if (insufficientCreepCount > 0) {
      this.sendScout()
    } else if (insufficientCreepCount === 0) {
      const hasDyingCreep = creeps.some(creep => creep.ticksToLive != null && creep.ticksToLive < (this.estimatedTravelDistance + 100))
      if (hasDyingCreep === true) {
        this.sendScout()
      }
    }
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => {
        const task = this.creepTask(creep)
        if (task == null) {
          return null
        }
        return FleeFromAttackerTask.create(task, this.fleeRange)
      },
      () => true,
    )
  }

  private sendScout(): void {
    if (this.stopSpawning === true) {
      return
    }

    const body = ((): BodyPartConstant[] => {
      if (this.useAttacker === true) {
        return [ATTACK, MOVE]
      }
      return [MOVE]
    })()

    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.High,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [CreepRole.Scout],
      body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private scoutMoveToFlagTask(creep: Creep): CreepTask | null {
    if (creep.room.name !== this.targetRoomName) {
      return MoveToRoomTask.create(this.targetRoomName, [])
    }

    const targetedBy = (position: RoomPosition): number => {
      return World.resourcePools.countCreeps(this.parentRoomName, this.identifier, creep => {
        if (creep.v5task == null) {
          return false
        }
        if (!(creep.v5task instanceof SequentialTask)) {
          return false
        }
        const moveToTask = creep.v5task.childTasks.find(task => task instanceof MoveToTask) as MoveToTask | undefined
        if (moveToTask == null) {
          return false
        }
        if (moveToTask.destinationPosition.isEqualTo(position)) {
          return true
        }
        return false
      })
    }

    const flags = creep.room.find(FIND_FLAGS).sort((lhs, rhs) => {
      return targetedBy(lhs.pos) < targetedBy(rhs.pos) ? -1 : 1
    })
    const targetFlag = flags[0]
    if (targetFlag == null) {
      return null
    }

    const tasks: CreepTask[] = [
      MoveToTask.create(targetFlag.pos, 0),
      EndlessTask.create(),
    ]
    const options: SequentialTaskOptions = {
      ignoreFailure: false,
      finishWhenSucceed: false,
    }

    return SequentialTask.create(tasks, options)
  }

  private creepTask(creep: Creep): CreepTask | null {
    if (creep.pos.roomName !== this.targetRoomName) {
      const waypoints = GameMap.getWaypoints(creep.room.name, this.targetRoomName) ?? []
      const tasks: CreepTask[] = [
        MoveToRoomTask.create(this.targetRoomName, waypoints, true),
        MoveToTask.create(new RoomPosition(25, 25, this.targetRoomName), 15),
      ]
      return SequentialTask.create(tasks, {ignoreFailure: false, finishWhenSucceed: false})
    }

    if (this.halt > 0) {
      creep.say(`${this.halt}`)
      return null
    }

    const result = this.targetConstructionSite(creep)
    const targetSite = result.target
    if (targetSite == null) {
      if (creep.room.controller == null) {
        return null
      }
      // TODO: 到達不能チェックを軽量に行える場合は行う
      // const controller = creep.room.controller
      // if (this.shouldSign === "unchecked") {
      //   this.shouldSign = ((): SignStatus => {
      //     if (controller.sign?.username === Game.user.name) {
      //       return "done"
      //     }

      //     const options: FindPathOpts = {
      //       maxRooms: 1,
      //       maxOps: 800,
      //       ignoreCreeps: true,
      //     }
      //     const path = creep.room.findPath(creep.pos, controller.pos, options)
      //     const lastPosition = path[path.length - 1]

      //     if (lastPosition == null || controller.pos.isNearTo(lastPosition.x, lastPosition.y) !== true) {
      //       return "done" // 到達不能
      //     }

      //     return "sign"
      //   })()
      // }
      // if (this.shouldSign === "sign") {
      //   if (creep.room.controller.sign?.username === Game.user.name) {
      //     this.shouldSign = "done"
      //   } else {
      //     return MoveToTargetTask.create(SignApiWrapper.create(creep.room.controller, Sign.signForHostileRoom()))
      //   }
      // }
      return null
    }
    if (targetSite.progress <= 0 && result.constructionSiteCount <= 2) {
      this.halt = 8
    }
    if (targetSite.pos.isEqualTo(creep.pos) === true) {
      return FleeFromTask.create(targetSite.pos, 1)
    }
    return StompTask.create(targetSite.pos, {ignoreSwamp: this.useAttacker !== true})
  }

  private targetConstructionSite(creep: Creep): { target: ConstructionSite<BuildableStructureConstant> | null, constructionSiteCount: number } {
    const constructionSites: ConstructionSiteInfo[] = creep.room.find(FIND_HOSTILE_CONSTRUCTION_SITES).map(constructionSite => {
      return {
        constructionSite,
        priority: this.prioritize(constructionSite),
      }
    })

    constructionSites.sort((lhs, rhs) => rhs.priority - lhs.priority)
    const target = constructionSites.find(constructionSite => {
      if (constructionSite.constructionSite.pos.findInRange(FIND_HOSTILE_STRUCTURES, 0, { filter: { structureType: STRUCTURE_RAMPART } }).length > 0) {
        return false
      }
      if (constructionSite.constructionSite.pos.lookFor(LOOK_TERRAIN)[0] === "wall") {
        return false
      }
      if (constructionSite.constructionSite.pos.findInRange(FIND_HOSTILE_CREEPS, 0).length > 0) {
        return false
      }
      return true
    })?.constructionSite ?? null

    return {
      target,
      constructionSiteCount: constructionSites.length,
    }
  }

  private prioritize(constructionSite: ConstructionSite<BuildableStructureConstant>): number {
    const structurePriority = targetPriority.indexOf(constructionSite.structureType) + 2  // -1を正の数に直すため
    const constructionProgress = constructionSite.progress / constructionSite.progressTotal
    return (constructionProgress * 100) + (structurePriority * 10)
  }

  private checkScoutAttacked(): boolean {
    const targetRoom = Game.rooms[this.targetRoomName]
    if (targetRoom == null) {
      return false
    }

    const hasMyTombstone = targetRoom.find(FIND_TOMBSTONES).some(tomb => tomb.creep.my === true && (tomb.creep.ticksToLive ?? 0) > 1)
    return hasMyTombstone
  }

  private calculateTravelDistance(): number {
    // return GameMap.estimatedTravelDistance(this.parentRoomName, this.targetRoomName)
    return 400
  }
}
