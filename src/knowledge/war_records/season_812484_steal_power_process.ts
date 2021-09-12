import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { roomLink } from "utility/log"
import { World } from "world_info/world_info"
import { RoomName } from "utility/room_name"
import { ProcessState } from "process/process_state"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { generateCodename } from "utility/unique_id"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { SequentialTask, SequentialTaskOptions } from "v5_object_task/creep_task/combined_task/sequential_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { EndlessTask } from "v5_object_task/creep_task/meta_task/endless_task"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { processLog } from "os/infrastructure/logger"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"
import { GameConstants } from "utility/constants"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { SwampRunnerTransferTask } from "v5_object_task/creep_task/meta_task/swamp_runner_transfer_task"
import { bodyCost } from "utility/creep_body"

interface Season812484StealPowerProcessCreepSpec {
  maxCount: number
  roles: CreepRole[]
  body: BodyPartConstant[]
}

export interface Season812484StealPowerProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  /** power bank info */
  pb: {
    /** power amount */
    pa: number

    /** position */
    p: RoomPositionState
  } | null

  /** pickup finished */
  f: boolean
}

export class Season812484StealPowerProcess implements Process, Procedural {
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly identifier: string
  private readonly codename: string

  private readonly scoutSpec: Season812484StealPowerProcessCreepSpec = {
    maxCount: 1,
    roles: [CreepRole.Scout],
    body: [MOVE],
  }
  private get haulerSpec(): Season812484StealPowerProcessCreepSpec {
    const roles = [CreepRole.Hauler, CreepRole.Mover]
    const parentRoom = Game.rooms[this.parentRoomName]

    if (this.powerBankInfo == null || parentRoom == null) {
      return {
        maxCount: 4,
        roles,
        body: [CARRY, CARRY, CARRY, CARRY, CARRY, MOVE],
      }
    }

    // max:
    // 2450 capacity
    // 2500E = RCL6
    const body: BodyPartConstant[] = [MOVE]
    const bodyUnit = [CARRY]
    const energyCapacity = parentRoom.energyCapacityAvailable
    const requiredCarryCount = Math.ceil(this.powerBankInfo.powerAmount / GameConstants.creep.actionPower.carryCapacity)
    const creepMaxCarryCount = Math.min(Math.floor((energyCapacity - bodyCost(body)) / bodyCost(bodyUnit)), 49)
    const creepMaxCount = 4
    const requiredCreepCount = Math.min(Math.ceil(requiredCarryCount / creepMaxCarryCount), creepMaxCount)

    const creepCarryCount = ((): number => {
      const estimatedCarryCount = requiredCreepCount * creepMaxCarryCount
      if (estimatedCarryCount > requiredCarryCount) {
        return Math.ceil(requiredCarryCount / requiredCreepCount)
      }
      return creepMaxCarryCount
    })()
    const bodyUnitCount = creepCarryCount

    for (let i = 0; i < bodyUnitCount; i += 1) {
      body.unshift(...bodyUnit)
    }

    // console.log(`requiredCarryCount: ${requiredCarryCount}, requiredCreepCount: ${requiredCreepCount}, creepCarryCount: ${creepCarryCount}, body: ${body.length}`)

    return {
      maxCount: requiredCreepCount,
      roles,
      body,
    }
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private powerBankInfo: {
      powerAmount: number,
      position: RoomPosition,
    } | null,
    private pickupFinished: boolean,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season812484StealPowerProcessState {
    return {
      t: "Season812484StealPowerProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      pb: (() => {
        if (this.powerBankInfo == null) {
          return null
        }
        return {
          pa: this.powerBankInfo.powerAmount,
          p: this.powerBankInfo.position.encode(),
        }
      })(),
      f: this.pickupFinished,
    }
  }

  public static decode(state: Season812484StealPowerProcessState): Season812484StealPowerProcess | null {
    const powerBankInfo = (() => {
      if (state.pb == null) {
        return null
      }
      const position = decodeRoomPosition(state.pb.p)
      return {
        powerAmount: state.pb.pa,
        position,
      }
    })()
    return new Season812484StealPowerProcess(state.l, state.i, state.p, state.tr, state.w, powerBankInfo, state.f)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[]): Season812484StealPowerProcess {
    return new Season812484StealPowerProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, null, false)
  }

  public processShortDescription(): string {
    const finishStatus = this.pickupFinished ? "finished" : "working"
    return `${roomLink(this.targetRoomName)} ${finishStatus}`
  }

  public runOnTick(): void {
    const targetRoom = Game.rooms[this.targetRoomName]
    let scoutCount = 0
    let haulerCount = 0
    const haulerSpec = this.haulerSpec

    scoutCount = this.countCreep(this.scoutSpec.roles)
    haulerCount = this.countCreep(haulerSpec.roles)

    let powerBank: StructurePowerBank | null = null
    let powerResource: Resource | Ruin | null = null

    if (targetRoom == null) {
      if (scoutCount <= this.scoutSpec.maxCount) {
        this.addScout()
      }
    } else {
      powerBank = targetRoom.find(FIND_STRUCTURES).find(structure => structure.structureType === STRUCTURE_POWER_BANK) as StructurePowerBank | null

      if (powerBank != null) {
        if (this.powerBankInfo == null) {
          this.powerBankInfo = {
            powerAmount: powerBank.power,
            position: powerBank.pos,
          }
        }
      } else {
        powerResource = ((): Resource | Ruin | null => {
          if (this.powerBankInfo == null) {
            PrimitiveLogger.programError(`${this.constructor.name} power bank info is null`)
            const resource = targetRoom.find(FIND_DROPPED_RESOURCES).find(resource => resource.resourceType === RESOURCE_POWER)
            if (resource != null) {
              return resource
            }
          } else {
            const resource = this.powerBankInfo.position.findInRange(FIND_DROPPED_RESOURCES, 0).find(resource => resource.resourceType === RESOURCE_POWER)
            if (resource != null) {
              return resource
            }
          }

          const ruin = targetRoom.find(FIND_RUINS).find(ruin => ruin.structure.structureType === STRUCTURE_POWER_BANK)
          return ruin ?? null
        })()
        if (powerBank == null && powerResource == null) {
          this.pickupFinished = true
        }
      }

      const almost = powerBank != null && powerBank.hits < (powerBank.hitsMax / 2)
      if (powerResource != null || almost) {
        if (haulerCount < haulerSpec.maxCount) {
          this.addHauler()
        }
      }
    }

    this.runScout()
    this.runHauler(powerBank, powerResource)

    const workingStatus = this.pickupFinished ? "Pick up finished" : "Working..."
    const haulerCapacity = haulerSpec.body.filter(body => body === CARRY).length * GameConstants.creep.actionPower.carryCapacity
    const haulerDescription = `(${haulerSpec.maxCount} haulers x ${haulerCapacity} capacity)`
    processLog(this, `${workingStatus} ${roomLink(this.targetRoomName)} ${scoutCount} scouts, ${haulerCount} haulers ${haulerDescription}`)
  }

  // ---- Hauler ---- //
  private addHauler(): void {
    if (this.pickupFinished === true) {
      return
    }
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Medium,
      numberOfCreeps: this.haulerSpec.maxCount,
      codename: "swamp_runner",
      roles: this.haulerSpec.roles,
      body: this.haulerSpec.body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runHauler(powerBank: StructurePowerBank | null, powerResource: Resource | Ruin | null): void {
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.haulerTask(creep, powerBank, powerResource),
      creep => hasNecessaryRoles(creep, this.haulerSpec.roles),
    )
  }

  private haulerTask(creep: Creep, powerBank: StructurePowerBank | null, powerResource: Resource | Ruin | null): CreepTask | null {
    if (powerBank != null) {
      const tasks: CreepTask[] = [
        MoveToRoomTask.create(this.targetRoomName, this.waypoints),
        MoveToTask.create(powerBank.pos, 4),
      ]
      return SequentialTask.create(tasks, { ignoreFailure: true, finishWhenSucceed: false })
    }

    const store = ((): StructureTerminal | StructureStorage | null => {
      const parentRoom = Game.rooms[this.parentRoomName]
      if (parentRoom == null) {
        return null
      }
      return parentRoom.terminal ?? parentRoom.storage ?? null
    })()
    if (store == null) {
      creep.say("no store")
      PrimitiveLogger.fatal(`${this.constructor.name} parent room ${roomLink(this.parentRoomName)} does not have terminal nor storage`)
      return null
    }

    if (creep.store.getUsedCapacity(RESOURCE_POWER) > 0) {
      return SwampRunnerTransferTask.create(TransferResourceApiWrapper.create(store, RESOURCE_POWER))
    }

    if (powerResource == null) {
      if (this.pickupFinished === true) {
        creep.say("finished")
        return null
      } else {
        creep.say("error")
        PrimitiveLogger.fatal(`${this.constructor.name} no visual to ${roomLink(this.targetRoomName)}`)
        this.pickupFinished = true
        return null
      }
    }

    const tasks: CreepTask[] = [
      MoveToTargetTask.create(WithdrawResourceApiWrapper.create(powerResource, RESOURCE_POWER)),
      SwampRunnerTransferTask.create(TransferResourceApiWrapper.create(store, RESOURCE_POWER)),
    ]

    return SequentialTask.create(tasks, { ignoreFailure: false, finishWhenSucceed: false })
  }

  // ---- Scout ---- //
  private addScout(): void {
    if (this.pickupFinished === true) {
      return
    }
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.High,
      numberOfCreeps: this.scoutSpec.maxCount,
      codename: this.codename,
      roles: this.scoutSpec.roles,
      body: this.scoutSpec.body,
      initialTask: this.scoutTask(),
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runScout(): void {
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      () => this.scoutTask(),
      creep => hasNecessaryRoles(creep, this.scoutSpec.roles),
    )
  }

  private scoutTask(): CreepTask {
    const options: SequentialTaskOptions = {
      ignoreFailure: true,
      finishWhenSucceed: false,
    }
    const tasks: CreepTask[] = [
      MoveToRoomTask.create(this.targetRoomName, this.waypoints),
      MoveToTask.create(new RoomPosition(25, 25, this.targetRoomName), 10),
      EndlessTask.create(),
    ]
    return SequentialTask.create(tasks, options)
  }

  // ---- Functions ---- //
  private countCreep(roles: CreepRole[]): number {
    return World.resourcePools.countCreeps(this.parentRoomName, this.identifier, creep => hasNecessaryRoles(creep, roles))
  }
}