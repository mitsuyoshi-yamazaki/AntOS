import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
import { coloredText, roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"
import { CreepName, defaultMoveToOptions } from "prototype/creep"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { UniqueId } from "utility/unique_id"
import type { Timestamp } from "shared/utility/timestamp"
import { CreepBody } from "utility/creep_body"
import { RoomResources } from "room_resource/room_resources"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { GameMap } from "game/game_map"
import { isSpawningSpawn, SpawningSpawn } from "shared/utility/spawn"
import { OwnedRoomProcess } from "process/owned_room_process"
import { MessageObserver } from "os/infrastructure/message_observer"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { SignApiWrapper } from "v5_object_task/creep_task/api_wrapper/sign_controller_api_wrapper"
import { Sign } from "game/sign"

ProcessDecoder.register("DisturbCreepSpawnProcess", state => {
  return DisturbCreepSpawnProcess.decode(state as DisturbCreepSpawnProcessState)
})

type SignStatus = "unchecked" | "sign" | "done"
type TargetInstances = {
  readonly spawns: StructureSpawn[]
  readonly spawningSpawns: SpawningSpawn[]
  readonly targetCreeps: Creep[]
}
const bodyPriority: BodyPartConstant[] = [  // 添字の大きい方が後方
  MOVE,
  ATTACK,
  HEAL,
]
const targetCreepBodies: BodyPartConstant[] = [
  ATTACK,
  RANGED_ATTACK,
  HEAL,
  CARRY,
]
const targetCreepFilter = (creep: Creep): boolean => {
  return creep.body.some(body => targetCreepBodies.includes(body.type))
}

interface DisturbCreepSpawnProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetRoomName: RoomName
  readonly travelDistance: number
  readonly stopSpawningReasons: string[]
  readonly lastKillTime: Timestamp | null
  readonly codename?: string
}

export class DisturbCreepSpawnProcess implements Process, Procedural, OwnedRoomProcess, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }
  public get ownedRoomName(): RoomName {
    return this.roomName
  }

  private readonly codename: string
  private creepStatus = null as Map<CreepName, "spawn queue" | "active" | "dying"> | null
  private cachedAttackerBody = null as Readonly<{ body: BodyPartConstant[], energyCapacity: number }> | null
  private cachedTargets = null as Readonly<{ spawnIds: Set<Id<StructureSpawn>> }> | null
  private targets = null as TargetInstances | null
  private shouldSign = "unchecked" as SignStatus
  private readyToSignCreepCount = 0
  private canAttackSpawn = false as boolean

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly targetRoomName: RoomName,
    private readonly travelDistance: number,
    private stopSpawningReasons: string[],
    private lastKillTime: Timestamp | null,
    private readonly specifiedCodename: string | null,
  ) {
    this.identifier = `${this.constructor.name}_${this.processId}_${this.targetRoomName}`
    this.codename = specifiedCodename ?? UniqueId.generateCodename(this.identifier, this.launchTime)
  }

  public encode(): DisturbCreepSpawnProcessState {
    return {
      t: "DisturbCreepSpawnProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetRoomName: this.targetRoomName,
      travelDistance: this.travelDistance,
      stopSpawningReasons: this.stopSpawningReasons,
      lastKillTime: this.lastKillTime,
      codename: this.specifiedCodename ?? undefined,
    }
  }

  public static decode(state: DisturbCreepSpawnProcessState): DisturbCreepSpawnProcess {
    return new DisturbCreepSpawnProcess(
      state.l,
      state.i,
      state.roomName,
      state.targetRoomName,
      state.travelDistance,
      state.stopSpawningReasons,
      state.lastKillTime,
      state.codename ?? null,
    )
  }

  public static create(processId: ProcessId, roomName: RoomName, targetRoomName: RoomName, travelDistance: number, codename: string | null): DisturbCreepSpawnProcess {
    return new DisturbCreepSpawnProcess(Game.time, processId, roomName, targetRoomName, travelDistance, [], null, codename)
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
    ]

    const targetRoom = Game.rooms[this.targetRoomName]
    if (targetRoom?.controller == null) {
      descriptions.push(roomLink(this.targetRoomName))
    } else {
      descriptions.push(`${roomLink(this.targetRoomName)} RCL${targetRoom.controller.level}`)
    }

    if (this.lastKillTime != null) {
      descriptions.push(`last kill ${Game.time - this.lastKillTime} ticks ago`)
    }

    if (this.stopSpawningReasons.length > 0) {
      descriptions.push(`stop spawning: ${this.stopSpawningReasons.join(",")}`)
    }

    descriptions.push(`sign: ${this.shouldSign}`)

    return descriptions.join(", ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "clear_kill_time", "resume", "stop"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`
      case "clear_kill_time":
        this.lastKillTime = null
        return "cleared"
      case "resume":
        this.stopSpawningReasons = []
        return "ok"
      case "stop":
        this.addStopSpawningReason("manually")
        return "ok"
      default:
        throw `Invalid command ${command}, see "help"`
      }
    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  }

  public runOnTick(): void {
    this.targets = null
    this.readyToSignCreepCount = 0

    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return
    }

    if (this.lastKillTime != null && Game.time > (this.lastKillTime + 1000)) {
      this.lastKillTime = null
    }

    if (this.creepStatus == null) {
      const creepStatus = new Map<CreepName, "spawn queue" | "active" | "dying">() // インスタンス化時にはWorldInfoが初期化されているか怪しいためここで行う
      World.resourcePools.getCreeps(this.roomName, this.taskIdentifier, () => true).forEach(creep => {
        if (creep.ticksToLive == null) {
          creepStatus.set(creep.name, "active")
          return
        }
        if (creep.ticksToLive > 2) {
          creepStatus.set(creep.name, "active")
          return
        }
        creepStatus.set(creep.name, "dying")
      })

      this.creepStatus = creepStatus
    }

    const status = Array.from(this.creepStatus.entries())
    const creeps: Creep[] = []

    status.forEach(([creepName, aliveStatus]) => {
      const creep = Game.creeps[creepName]
      if (creep == null) {
        this.creepStatus?.delete(creepName)
        if (aliveStatus === "active") {
          if (this.lastKillTime != null && Game.time <= (this.lastKillTime + 1000)) {
            this.addStopSpawningReason("creep killed")
          }
          this.lastKillTime = Game.time
        }
        return
      }

      creeps.push(creep)
      if (creep.ticksToLive != null && creep.ticksToLive <= 2) {
        this.creepStatus?.set(creepName, "dying")
        return
      }
      this.creepStatus?.set(creepName, "active")
    })

    const shouldSpawn = ((): boolean => {
      if (this.stopSpawningReasons.length > 0) {
        return false
      }
      switch (creeps.length) {
      case 0:
        return true
      case 1: {
        const creep = creeps[0]
        if (creep == null) {
          return true
        }
        if (creep.ticksToLive == null) {
          return false
        }
        if (creep.ticksToLive > (this.travelDistance + 300)) {
          return false
        }
        return true
      }
      default:
        return false
      }
    })()

    if (shouldSpawn === true) {
      this.spawnCreep(roomResource.room.energyCapacityAvailable)
    }

    if (this.shouldSign === "sign") {
      creeps.sort((lhs, rhs) => (rhs.ticksToLive ?? 0) - (lhs.ticksToLive ?? 0))
    }
    creeps.forEach(creep => this.runCreep(creep))
  }

  private runCreep(creep: Creep): void {
    if (creep.v5task != null) {
      this.heal(creep)
      return
    }

    if (creep.room.name !== this.targetRoomName) {
      const waypoints = GameMap.getWaypoints(creep.room.name, this.targetRoomName) ?? []
      creep.v5task = FleeFromAttackerTask.create(MoveToRoomTask.create(this.targetRoomName, waypoints))

      this.heal(creep)
      return
    }

    if (this.shouldSign === "unchecked") {
      this.shouldSign = ((): SignStatus => {
        const controller = creep.room.controller
        if (controller == null) {
          return "done"
        }
        if (controller.sign == null) {
          return "sign"
        }
        if (controller.sign.username === Game.user.name) {
          return "done"
        }
        return "sign"
      })()
    }

    const targetCreeps = this.getTargetCreeps(creep.room)
    if (targetCreeps.length > 0) {
      const target = creep.pos.findClosestByPath(targetCreeps)
      if (target != null) {
        creep.moveTo(target, defaultMoveToOptions())
        if (creep.pos.isNearTo(target.pos) === true) {
          creep.attack(target)
        } else {
          this.heal(creep)
        }
      } else {
        this.heal(creep)
      }
      return
    }

    this.heal(creep)

    if (this.readyToSignCreepCount >= 1 && this.shouldSign === "sign" && creep.room.controller != null && creep.ticksToLive != null && creep.ticksToLive < 300) {
      if (creep.room.controller.sign?.username === Game.user.name) {
        this.shouldSign = "done"
      } else {
        const sign = Sign.signForHostileRoom()
        creep.v5task = MoveToTargetTask.create(SignApiWrapper.create(creep.room.controller, sign))
        return
      }
    }

    const spawningSpawn = this.getSpawiningSpawns(creep.room)[0]
    if (spawningSpawn != null) {
      const spawnDirection = (spawningSpawn.spawning.directions ?? [])[0] ?? TOP
      const spawningPosition = spawningSpawn.pos.positionTo(spawnDirection)

      if (spawningPosition == null) {
        creep.moveTo(spawningSpawn.pos, defaultMoveToOptions())
        return
      }
      if (this.canAttackSpawn === true && creep.pos.getRangeTo(spawningPosition) <= 1) {
        creep.attack(spawningSpawn)
        return
      }
      creep.moveTo(spawningPosition, defaultMoveToOptions())
      return
    }

    const spawn = this.getSpawns(creep.room)[0]
    if (spawn != null) {
      if (this.canAttackSpawn === true && creep.pos.getRangeTo(spawn.pos) <= 1) {
        this.readyToSignCreepCount += 1
        creep.attack(spawn)
        return
      }
      creep.moveTo(spawn.pos, defaultMoveToOptions())
      return
    }

    creep.say("nth to do")
    this.addStopSpawningReason("nothing to do")
  }

  private heal(creep: Creep): void {
    if (creep.hits >= creep.hitsMax) {
      return
    }
    creep.heal(creep)
  }

  private getTargetCreeps(targetRoom: Room): Creep[] {
    if (this.targets == null) {
      this.targets = this.refreshTargetInstances(targetRoom)
    }
    return this.targets.targetCreeps
  }

  private getSpawiningSpawns(targetRoom: Room): SpawningSpawn[] {
    if (this.targets == null) {
      this.targets = this.refreshTargetInstances(targetRoom)
    }
    return this.targets.spawningSpawns
  }

  private getSpawns(targetRoom: Room): StructureSpawn[] {
    if (this.targets == null) {
      this.targets = this.refreshTargetInstances(targetRoom)
    }
    return this.targets.spawns
  }

  private refreshTargetInstances(targetRoom: Room): TargetInstances {
    if (this.cachedTargets == null) {
      this.cachedTargets = {
        spawnIds: new Set(targetRoom.find(FIND_HOSTILE_SPAWNS).map(spawn => spawn.id)),
      }
    }

    const spawns: StructureSpawn[] = []
    this.cachedTargets.spawnIds.forEach(spawnId => {
      const spawn = Game.getObjectById(spawnId)
      if (spawn == null) {
        this.cachedTargets?.spawnIds.delete(spawnId)
        return
      }
      spawns.push(spawn)
    })
    this.canAttackSpawn = spawns.length > 1

    const spawningSpawns: SpawningSpawn[] = spawns.flatMap((spawn): SpawningSpawn[] => {
      if (isSpawningSpawn(spawn)) {
        return [spawn]
      }
      return []
    })
    const targetCreeps = targetRoom.find(FIND_HOSTILE_CREEPS).filter(targetCreepFilter)

    return {
      spawns,
      targetCreeps,
      spawningSpawns,
    }
  }

  private spawnCreep(energyCapacity: number): void {
    const creepName = UniqueId.generateCreepName(this.codename)
    this.creepStatus?.set(creepName, "spawn queue")

    if (this.cachedAttackerBody == null || this.cachedAttackerBody.energyCapacity !== energyCapacity) {
      const body = CreepBody.create([HEAL, MOVE], [ATTACK, MOVE], energyCapacity, 7)
      body.sort((lhs, rhs) => {
        const lIndex = bodyPriority.indexOf(lhs)
        const rIndex = bodyPriority.indexOf(rhs)
        return lIndex - rIndex
      })

      this.cachedAttackerBody = {
        body,
        energyCapacity,
      }
    }


    World.resourcePools.addSpawnCreepRequest(this.roomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [],
      body: this.cachedAttackerBody.body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
      name: creepName,
    })
  }

  private addStopSpawningReason(reason: string): void {
    if (this.stopSpawningReasons.includes(reason) === true) {
      return
    }
    this.stopSpawningReasons.push(reason)
  }
}
