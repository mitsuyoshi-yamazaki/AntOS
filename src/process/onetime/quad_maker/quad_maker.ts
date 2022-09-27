import type { RoomName } from "shared/utility/room_name_types"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { QuadCreepSpec, QuadSpec } from "../../../../submodules/private/attack/quad/quad_spec"
import { CreepBody } from "utility/creep_body"
import { RoomResources } from "room_resource/room_resources"
import { GameConstants } from "utility/constants"
import { Result, ResultFailed } from "shared/utility/result"
import { OperatingSystem } from "os/os"
import { SpecializedQuadLaunchArguments, SpecializedQuadProcess } from "../../../../submodules/private/attack/quad/quad_process"
import { GameMap } from "game/game_map"
import { LaunchQuadProcess } from "./launch_quad_process"
import { State, Stateful } from "os/infrastructure/state"

export interface QuadMakerState extends State {
  quadName: string
  readonly roomName: RoomName
  readonly targetRoomName: RoomName
  readonly frontBaseRoomName: RoomName | null
  readonly canHandleMelee: boolean
  readonly damageTolerance: number // 0.0~1.0
  readonly boosts: MineralBoostConstant[]
  readonly creepSpecs: QuadCreepSpec[]
  readonly targetIds: Id<AnyCreep | AnyStructure>[]
  readonly quadProcessCodename: string | null
}

type QuadLaunchInfoDryRun = {
  result: string
}
type QuadLaunchInfoRelease = {
  process: SpecializedQuadProcess | LaunchQuadProcess
  result: string
}
type QuadLaunchInfo<DryRun extends boolean> = DryRun extends true ? QuadLaunchInfoDryRun : QuadLaunchInfoRelease

interface QuadMakerInterface {
  shortDescription(): string
  description(): string
  currentQuadSpec(): QuadSpec | null
  verify(): Result<{ quadSpec: QuadSpec, warnings: string[] }, string[]>
  launchQuadProcess<DryRun extends boolean>(dryRun: DryRun, delay: number | null): Result<QuadLaunchInfo<DryRun>, string>
}

export class QuadMaker implements QuadMakerInterface, Stateful {
  private constructor(
    public readonly quadName: string,
    public roomName: RoomName,
    public targetRoomName: RoomName,
    public frontBaseRoomName: RoomName | null,
    public canHandleMelee: boolean,
    public damageTolerance: number,
    public boosts: MineralBoostConstant[],
    public creepSpecs: QuadCreepSpec[],
    public targetIds: Id<AnyCreep | AnyStructure>[],
    public quadProcessCodename: string | null,
  ) {
  }

  public encode(): QuadMakerState {
    return {
      t: "QuadMaker",
      quadName: this.quadName,
      roomName: this.roomName,
      targetRoomName: this.targetRoomName,
      frontBaseRoomName: this.frontBaseRoomName,
      canHandleMelee: this.canHandleMelee,
      damageTolerance: this.damageTolerance,
      boosts: this.boosts,
      creepSpecs: this.creepSpecs,
      targetIds: this.targetIds,
      quadProcessCodename: this.quadProcessCodename,
    }
  }

  public static decode(state: QuadMakerState): QuadMaker {
    return new QuadMaker(
      state.quadName,
      state.roomName,
      state.targetRoomName,
      state.frontBaseRoomName,
      state.canHandleMelee,
      state.damageTolerance,
      state.boosts,
      state.creepSpecs,
      state.targetIds,
      state.quadProcessCodename,
    )
  }

  public static create(quadSpec: QuadSpec, roomName: RoomName, targetRoomName: RoomName): QuadMaker
  public static create(quadName: string, roomName: RoomName, targetRoomName: RoomName): QuadMaker
  public static create(arg: string | QuadSpec, roomName: RoomName, targetRoomName: RoomName): QuadMaker {
    const { quadName, canHandleMelee, boosts, damageTolerance, creepSpecs } = ((): { quadName: string, canHandleMelee: boolean, damageTolerance: number, boosts: MineralBoostConstant[], creepSpecs: QuadCreepSpec[] } => {
      if (typeof arg === "string") {
        return {
          quadName: arg,
          canHandleMelee: QuadSpec.canHandleMeleeDefaultValue,
          damageTolerance: QuadSpec.defaultDamageTolerance,
          boosts: [],
          creepSpecs: [],
        }
      } else {
        const quadSpec = arg
        return {
          quadName: quadSpec.shortDescription,
          canHandleMelee: quadSpec.canHandleMelee,
          damageTolerance: quadSpec.defaultDamageTolerance,
          boosts: quadSpec.boosts,
          creepSpecs: quadSpec.creepSpecs,
        }
      }
    })()
    const frontBaseRoomName: RoomName | null = null
    return new QuadMaker(quadName, roomName, targetRoomName, frontBaseRoomName, canHandleMelee, damageTolerance, boosts, creepSpecs, [], null)
  }

  public cloned(quadName: string): QuadMaker {
    const state = this.encode()
    state.quadName = quadName
    return QuadMaker.decode(state)
  }

  public shortDescription(): string {
    return `${this.quadName} ${this.roomPathDescription()}`
  }

  public description(): string {
    const quadSpec = this.createQuadSpec()
    if (typeof quadSpec === "string") {
      return `${quadSpec}:
${this.quadName} ${this.roomPathDescription()}
handle melee: ${this.canHandleMelee}
damage tolerance: ${this.damageTolerance}
boosts: ${this.boosts.map(boost => coloredResourceType(boost)).join(",")}
creeps: ${this.creepSpecs.length} creeps
targets: ${this.targetIds.length} target IDs
      `
    }

    const descriptions: string[] = [
      this.roomPathDescription()
    ]
    if (this.targetIds.length > 0) {
      descriptions.push(`${this.targetIds.length} targets`)
    }
    if (this.quadProcessCodename != null) {
      descriptions.push(`creep codename: "${this.quadProcessCodename}"`)
    }
    descriptions.push(quadSpec.description())
    return descriptions.join("\n")
  }

  public verify(): Result<{ quadSpec: QuadSpec, warnings: string[] }, string[]> {
    const warningPrefix = coloredText("[WARN]", "warn")
    const errorPrefix = coloredText("[ERROR]", "error")
    const warnings: string[] = []
    const errors: string[] = []

    const resultFailed = (): ResultFailed<string[]> => {
      errors.push(...warnings)
      return Result.Failed(errors)
    }

    const noWaypointError = (fromRoomName: RoomName, toRoomName: RoomName): string => {
      return `${errorPrefix} waypoints not set ${roomLink(fromRoomName)}=>${roomLink(toRoomName)}`
    }
    if (this.frontBaseRoomName != null) {
      if (GameMap.getWaypoints(this.roomName, this.frontBaseRoomName) == null) {
        errors.push(noWaypointError(this.roomName, this.frontBaseRoomName))
      }
      if (GameMap.getWaypoints(this.frontBaseRoomName, this.targetRoomName) == null) {
        errors.push(noWaypointError(this.frontBaseRoomName, this.targetRoomName))
      }
    } else {
      if (GameMap.getWaypoints(this.roomName, this.targetRoomName) == null) {
        errors.push(noWaypointError(this.roomName, this.targetRoomName))
      }
    }

    const roomResources = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResources == null) {
      errors.push(`${errorPrefix} ${roomLink(this.roomName)} is not mine`)
      return resultFailed()
    }
    const quadSpec = this.createQuadSpec()
    if (typeof quadSpec === "string") {
      errors.push(`${errorPrefix} ${quadSpec}`)
      return resultFailed()
    }

    const moveTier = ((): 0 | 1 | 2 | 3 => {
      if (this.boosts.includes(RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE) === true) {
        return 3
      }
      if (this.boosts.includes(RESOURCE_ZYNTHIUM_ALKALIDE) === true) {
        return 2
      }
      if (this.boosts.includes(RESOURCE_ZYNTHIUM_OXIDE) === true) {
        return 1
      }
      return 0
    })()
    warnings.push(...this.creepSpecs.flatMap(spec => {
      const warning = this.verifyMoveCount([...spec.body], moveTier)
      if (warning != null) {
        return [`${warningPrefix} ${warning}`]
      }
      return []
    }))

    const creepSpecErrors: string[] = this.creepSpecs.flatMap(spec => {
      if (spec.body.length > GameConstants.creep.body.bodyPartMaxCount) {
        return [`${errorPrefix} over body limit (${spec.body.length} parts) ${CreepBody.description(spec.body)}`]
      }
      return []
    })
    errors.push(...creepSpecErrors)

    const energyCapacityAvailable = roomResources.room.energyCapacityAvailable
    this.creepSpecs.forEach(spec => {
      const creepCost = CreepBody.cost(spec.body)
      if (creepCost > energyCapacityAvailable) {
        errors.push(`${errorPrefix} lack of energy capacity: required ${creepCost}e but capacity is ${energyCapacityAvailable} in ${roomLink(this.roomName)}`)
      }
    })

    const cost = quadSpec.energyCost()
    const storedEnergy = (roomResources.activeStructures.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
      + (roomResources.activeStructures.terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
    if (cost > storedEnergy) {
      errors.push(`${errorPrefix} lack of energy: required ${cost}e but ${storedEnergy}e in ${roomLink(this.roomName)}`)
      return resultFailed()
    }
    const safeEnergyAmount = Math.min(cost * 3, cost + 20000)
    if (safeEnergyAmount > storedEnergy) {
      warnings.push(`${warningPrefix} quad may cause energy shortage: required ${cost}e but ${storedEnergy}e in ${roomLink(this.roomName)}`)
    }

    if (errors.length <= 0) {
      return Result.Succeeded({
        quadSpec,
        warnings,
      })
    }
    return resultFailed()
  }

  private verifyMoveCount(body: BodyPartConstant[], moveTier: 0 | 1 | 2 | 3): string | null {
    const moveCount = body.reduce((result, current) => {
      if (current !== MOVE) {
        return result
      }
      return result + 1
    }, 0)
    const bodyCount = body.length - moveCount

    const movePower = moveCount * (moveTier + 1)
    if (bodyCount <= movePower) {
      return null
    }
    return `lack of move power: tier${moveTier} ${moveCount}MOVE, ${bodyCount} body`
  }

  public launchQuadProcess<DryRun extends boolean>(dryRun: DryRun, delay: number | null): Result<QuadLaunchInfo<DryRun>, string> {
    const parameterDescriptions: string[] = []
    if (dryRun === true) {
      parameterDescriptions.push("(dry run: set dry_run=0 to launch)")
    }
    if (delay != null) {
      parameterDescriptions.push(`delayed: ${delay} ticks`)
    }

    const result = this.verify()
    switch (result.resultType) {
    case "failed": {
      return Result.Failed(`Launch failed ${parameterDescriptions.join(", ")}\n${result.reason.join("\n")}`)
    }
    case "succeeded": {
      if (dryRun === true) {
        const header = `Launchable ${parameterDescriptions.join(", ")}`
        if (result.value.warnings.length > 0) {
          return Result.Failed(`${header}\n${result.value.warnings.join("\n")}\n${this.description()}`)
        }
        const launchInfo: QuadLaunchInfo<true> = { result: `${header}\n${this.description()}` }
        return Result.Succeeded(launchInfo as QuadLaunchInfo<DryRun>)
      }

      const launchArguments: SpecializedQuadLaunchArguments = {
        parentRoomName: this.roomName,
        targetRoomName: this.targetRoomName,
        predefinedTargetIds: this.targetIds,
        frontBaseRoomName: this.frontBaseRoomName,
      }

      const process = ((): LaunchQuadProcess | SpecializedQuadProcess => {
        if (delay != null) {
          return OperatingSystem.os.addProcess(null, processId => {
            return LaunchQuadProcess.create(processId, { case: "delay", launchTime: Game.time + delay }, launchArguments, result.value.quadSpec, this.quadProcessCodename)
          })
        }
        return OperatingSystem.os.addProcess(null, processId => {
          return SpecializedQuadProcess.create(
            processId,
            launchArguments,
            result.value.quadSpec,
            {
              codename: this.quadProcessCodename ?? undefined,
            },
          )
        })
      })()

      Memory.os.logger.filteringProcessIds.push(process.processId)
      const launchMessage = `${process.constructor.name} launched. Process ID: ${process.processId}`
      if (result.value.warnings.length > 0) {
        return Result.Failed(`${launchMessage}\n${result.value.warnings.join("\n")}\n${this.description()}`)
      }
      const launchInfo: QuadLaunchInfo<false> = {
        process,
        result: `${launchMessage}\n${this.description()}`,
      }
      return Result.Succeeded(launchInfo as QuadLaunchInfo<DryRun>)
    }
    }
  }

  public currentQuadSpec(): QuadSpec | null {
    const quadSpec = this.createQuadSpec()
    if (typeof quadSpec === "string") {
      return null
    }
    return quadSpec
  }

  private createQuadSpec(): QuadSpec | string {
    if (this.creepSpecs.length <= 0) {
      return "missing creep specification"
    }
    if (this.creepSpecs.length > 4) {
      return `${this.creepSpecs.length} creep specs`
    }
    return new QuadSpec(
      this.quadName,
      this.canHandleMelee,
      this.damageTolerance,
      [...this.boosts],
      [...this.creepSpecs],
    )
  }

  private roomPathDescription(): string {
    const roomNames: RoomName[] = []
    roomNames.push(this.roomName)
    if (this.frontBaseRoomName != null) {
      roomNames.push(this.frontBaseRoomName)
    }
    roomNames.push(this.targetRoomName)

    return roomNames.map(roomName => roomLink(roomName)).join("=&gt")
  }
}
