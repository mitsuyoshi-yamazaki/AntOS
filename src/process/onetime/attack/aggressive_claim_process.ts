import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { roomLink } from "utility/log"
import type { RoomName } from "shared/utility/room_name_types"
import { ProcessDecoder } from "process/process_decoder"
import { ProcessState } from "process/process_state"
import { World } from "world_info/world_info"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { UniqueId } from "utility/unique_id"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { processLog } from "os/infrastructure/logger"
import { OperatingSystem } from "os/os"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { ClaimControllerApiWrapper } from "v5_object_task/creep_task/api_wrapper/claim_controller_api_wrapper"

ProcessDecoder.register("AggressiveClaimProcess", state => {
  return AggressiveClaimProcess.decode(state as AggressiveClaimProcessState)
})

type TargetRoomState = "occupied" | "downgraded" | "claimed" | "cleaned"

export interface AggressiveClaimProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetRoomName: RoomName
  readonly targetRoomState: TargetRoomState
  readonly blockingWallIds: Id<StructureWall | StructureRampart>[]
  readonly excludeStructureIds: Id<AnyStructure>[]
}

export class AggressiveClaimProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly targetRoomName: RoomName,
    private targetRoomState: TargetRoomState,
    private readonly blockingWallIds: Id<StructureWall | StructureRampart>[],
    private readonly excludeStructureIds: Id<AnyStructure>[],
  ) {
    this.taskIdentifier = `${this.constructor.name}_${this.roomName}_${this.targetRoomName}`
    this.codename = UniqueId.generateCodename(this.taskIdentifier, this.launchTime)
  }

  public encode(): AggressiveClaimProcessState {
    return {
      t: "AggressiveClaimProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetRoomName: this.targetRoomName,
      targetRoomState: this.targetRoomState,
      blockingWallIds: this.blockingWallIds,
      excludeStructureIds: this.excludeStructureIds,
    }
  }

  public static decode(state: AggressiveClaimProcessState): AggressiveClaimProcess {
    return new AggressiveClaimProcess(state.l, state.i, state.roomName, state.targetRoomName, state.targetRoomState, state.blockingWallIds, state.excludeStructureIds)
  }

  public static create(
    processId: ProcessId,
    roomName: RoomName,
    targetRoomName: RoomName,
    blockingWallIds: Id<StructureWall | StructureRampart>[],
    excludeStructureIds: Id<AnyStructure>[],
  ): AggressiveClaimProcess {
    if (Memory.ignoreRooms.includes(targetRoomName) !== true) {
      Memory.ignoreRooms.push(targetRoomName)
    }
    return new AggressiveClaimProcess(Game.time, processId, roomName, targetRoomName, "occupied", blockingWallIds, excludeStructureIds)
  }

  public processShortDescription(): string {
    return `${roomLink(this.targetRoomName)}, state: ${this.targetRoomState}`
  }

  public deinit(): void {
    const index = Memory.ignoreRooms.indexOf(this.targetRoomName)
    if (index >= 0) {
      Memory.ignoreRooms.splice(index, 1)
    }
  }

  public runOnTick(): void {
    const targetRoom = Game.rooms[this.targetRoomName]
    if (targetRoom != null) {
      if (this.targetRoomState === "cleaned") {
        if (targetRoom.controller?.my === true) {
          const unclaimResult = targetRoom.controller?.unclaim()
          if (unclaimResult !== OK) {
            PrimitiveLogger.fatal(`${this.taskIdentifier} failed to unclaim ${roomLink(this.targetRoomName)} ${unclaimResult}`)
          }
          return
        }
        OperatingSystem.os.killProcess(this.processId)
        return
      }

      this.updateTargetRoomState(targetRoom)
    }

    const scouts: Creep[] = []
    const claimers: Creep[] = []
    const creeps = World.resourcePools.getCreeps(this.roomName, this.taskIdentifier)
    creeps.forEach(creep => {
      if (hasNecessaryRoles(creep, [CreepRole.Scout]) === true) {
        scouts.push(creep)
        return
      }
      if (hasNecessaryRoles(creep, [CreepRole.Claimer]) === true) {
        claimers.push(creep)
        return
      }
    })

    if (scouts.length <= 0 && targetRoom == null) {
      this.spawnScout()
    }

    const shouldSpawnClaimer = ((): boolean => {
      if (claimers.length > 0) {
        return false
      }
      if (targetRoom == null) {
        return false
      }
      if (targetRoom.controller?.owner != null) {
        return false
      }
      if (this.blockingWallIds.every(id => Game.getObjectById(id) == null) !== true) {
        return false
      }
      return true
    })()

    if (shouldSpawnClaimer === true) {
      this.spawnClaimer()
    }

    scouts.forEach(creep => this.runScout(creep))
    claimers.forEach(creep => this.runClaimer(creep))
  }

  private updateTargetRoomState(targetRoom: Room): void {
    switch (this.targetRoomState) {
    case "occupied":
      if (targetRoom.controller?.owner == null) {
        this.targetRoomState = "downgraded"
        processLog(this, `${roomLink(this.targetRoomName)} state changed occupied =&gt downgraded`)
      }
      if (targetRoom.controller?.my === true) {
        this.targetRoomState = "claimed"
        processLog(this, `${roomLink(this.targetRoomName)} state changed occupied =&gt claimed`)
      }
      break
    case "downgraded":
      if (targetRoom.controller?.my === true) {
        this.targetRoomState = "claimed"
        processLog(this, `${roomLink(this.targetRoomName)} state downgraded occupied =&gt claimed`)
      }
      break
    case "claimed":
      if (this.destroyStructures(targetRoom) === true) {
        this.targetRoomState = "cleaned"
        processLog(this, `${roomLink(this.targetRoomName)} state changed claimed =&gt cleaned`)
      }
      break
    case "cleaned":
      break
    }
  }

  private destroyStructures(targetRoom: Room): boolean {
    if (targetRoom.find(FIND_HOSTILE_CREEPS).length > 0) {
      return false
    }

    try {
      const destroyStructure = (structure: AnyStructure): void => {
        const result = structure.destroy()
        switch (result) {
        case OK:
          return
        case ERR_NOT_OWNER:
          throw `destroyStructure() ${roomLink(targetRoom.name)} is not mine`
        case ERR_BUSY:
          throw `destroyStructure() enemy in ${roomLink(targetRoom.name)}`
        }
      }

      const walls = targetRoom.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_WALL } })
      walls.forEach(wall => destroyStructure(wall))

      const hostileStructures = targetRoom.find(FIND_HOSTILE_STRUCTURES)
      hostileStructures.forEach(structure => {
        if (this.excludeStructureIds.includes(structure.id) === true) {
          return
        }
        destroyStructure(structure)
      })

    } catch (error) {
      PrimitiveLogger.fatal(`${this.taskIdentifier} ${error}`)
      return false
    }

    return true
  }

  private runClaimer(creep: Creep): void {
    if (creep.v5task != null) {
      return
    }

    if (creep.room.name !== this.targetRoomName) {
      creep.v5task = FleeFromAttackerTask.create(MoveToRoomTask.create(this.targetRoomName, [], true))
      return
    }

    const targetRoom = creep.room
    if (targetRoom.controller == null) {
      return
    }
    if (targetRoom.controller.my === true) {
      return
    }

    creep.v5task = FleeFromAttackerTask.create(MoveToTargetTask.create(ClaimControllerApiWrapper.create(targetRoom.controller)))
  }

  private runScout(creep: Creep): void {
    if (creep.v5task != null) {
      return
    }

    if (creep.room.name !== this.targetRoomName) {
      creep.v5task = FleeFromAttackerTask.create(MoveToRoomTask.create(this.targetRoomName, [], true))
      return
    }

    if (creep.pos.x < 47 && creep.pos.x > 2 && creep.pos.y < 47 && creep.pos.y > 2) {
      return
    }

    try {
      const position = new RoomPosition(25, 25, this.targetRoomName)
      creep.v5task = FleeFromAttackerTask.create(MoveToTask.create(position, 20, { ignoreSwamp: true }))
      return
    } catch {
      // does nothing
    }
  }

  private spawnClaimer(): void {
    World.resourcePools.addSpawnCreepRequest(this.roomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [CreepRole.Claimer],
      body: [MOVE, MOVE, MOVE, MOVE, CLAIM, MOVE],
      initialTask: null,
      taskIdentifier: this.taskIdentifier,
      parentRoomName: null,
    })
  }

  private spawnScout(): void {
    World.resourcePools.addSpawnCreepRequest(this.roomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [CreepRole.Scout],
      body: [MOVE],
      initialTask: null,
      taskIdentifier: this.taskIdentifier,
      parentRoomName: null,
    })
  }
}
