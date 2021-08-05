import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { CreepName } from "prototype/creep"
import { processLog } from "process/process_log"
import { GameConstants, OBSTACLE_COST } from "utility/constants"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { MessageObserver } from "os/infrastructure/message_observer"

interface QuadState {
  creepNames: CreepName[]
  moveToTarget: RoomName | RoomPositionState | null
}

class Quad {
  public get numberOfCreeps(): number {
    return this.creeps.length
  }

  private creeps: Creep[] = []

  public constructor(
    creepNames: CreepName[],
    private readonly moveToTarget: RoomName | RoomPosition | null
  ) {
    creepNames.forEach(creepName => {
      const creep = Game.creeps[creepName]
      if (creep != null) {
        this.creeps.push(creep)
      }
    })
  }

  public inRoom(roomName: RoomName): boolean {
    return this.creeps.every(creep => (creep.room.name === roomName))
  }

  // public moveToRoom(destinationRoomName: RoomName, waypoints: RoomName[]): void {
  //   if (this.isSquadForm() !== true) {
  //     this.align()
  //     return
  //   }
  //   if (this.canMoveToSquad() !== true) {
  //     return
  //   }
  //   // TODO:
  // }

  public moveLineTo(position: RoomPosition, range: number): void {
    if (this.canMove() !== true) {
      return
    }
  }

  public moveQuadTo(position: RoomPosition, range: number): void {
    if (this.isSquadForm() !== true) {
      this.align()
      return
    }
    if (this.canMoveQquad() !== true) {
      return
    }

    const topRight = this.creeps[0]
    if (topRight == null) {
      return
    }
    if (topRight.pos.isEqualTo(position) === true) {
      topRight.say("ok")
      return
    }

    const pathFinderOptions: FindPathOpts = {
      costCallback: quadCostcallback,
      range,
    }

    const nextStep = topRight.room.findPath(topRight.pos, position, pathFinderOptions)[0] // Room間移動は対応していない
    if (nextStep == null) {
      topRight.say("no path")
      return
    }
    const nextPosition = new RoomPosition(nextStep.x, nextStep.y, topRight.room.name)
    topRight.moveTo(nextPosition)
    this.moveFollowersToNextPosition(nextPosition)
  }

  public align(): void {
    const topRight = this.creeps[0]
    if (topRight == null) {
      return
    }

    const topRightPosition = ((): RoomPosition => {
      const x = Math.min(Math.max(topRight.pos.x, 2), 48)
      const y = Math.min(Math.max(topRight.pos.y, 1), 47)
      return new RoomPosition(x, y, topRight.pos.roomName)
    })()
    // topRight.say(`${topRightPosition.x},${topRightPosition.y}`)
    topRight.say("align")
    topRight.moveTo(topRightPosition)

    this.moveFollowersToNextPosition(topRightPosition)
  }

  private canMove(): boolean {
    if (this.creeps.length <= 0) {
      return false
    }
    return this.creeps.every(creep => (creep.fatigue <= 0))
  }

  private canMoveQquad(): boolean {
    if (this.canMove() !== true) {
      return false
    }
    return this.isSquadForm()
  }

  // private isLineForm(): boolean {
  //   const

  //   // const line = (creepIndex: number): void => {
  //   //   const previousCreep = this.creeps[creepIndex]
  //   //   const creep = this.creeps[creepIndex]
  //   //   if (previousCreep == null || creep == null) {
  //   //     return
  //   //   }
  //   //   creep.moveTo(previousCreep.pos)
  //   // }
  //   // line(0)
  //   // line(1)
  //   // line(2)
  // }

  private isSquadForm(): boolean {
    const topRight = this.creeps[0]
    if (topRight == null) {
      return false
    }

    const checkPosition = (creepIndex: number, directionFromTopRight: DirectionConstant): boolean => {
      const creep = this.creeps[creepIndex]
      if (creep == null) {
        return true
      }
      const position = topRight.pos.positionTo(directionFromTopRight)
      if (position == null || creep.pos.isEqualTo(position) !== true) {
        return false
      }
      return true
    }

    if (checkPosition(1, LEFT) !== true) {
      return false
    }
    if (checkPosition(2, BOTTOM) !== true) {
      return false
    }
    if (checkPosition(3, BOTTOM_LEFT) !== true) {
      return false
    }
    return true
  }

  private moveFollowersToNextPosition(nextPosition: RoomPosition): void {
    const move = (creepIndex: number, directionFromTopRight: DirectionConstant): void => {
      const creep = this.creeps[creepIndex]
      if (creep == null) {
        return
      }
      const position = nextPosition.positionTo(directionFromTopRight)
      if (position == null) {
        creep.say("no pos")
        return
      }
      creep.moveTo(position)
    }

    move(1, LEFT)
    move(2, BOTTOM)
    move(3, BOTTOM_LEFT)
  }
}

export interface Season1488500QuadProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  destination: RoomPositionState | null
  quadState: QuadState
}

// Game.io("launch -l Season1488500QuadProcess room_name=W3S24")
export class Season1488500QuadProcess implements Process, Procedural, MessageObserver {
  public readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    private destination: RoomPosition | null,
    private quadState: QuadState,
  ) {
    this.identifier = `${this.constructor.name}_${this.launchTime}_${this.parentRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season1488500QuadProcessState {
    return {
      t: "Season1488500QuadProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      destination: this.destination?.encode() ?? null,
      quadState: this.quadState,
    }
  }

  public static decode(state: Season1488500QuadProcessState): Season1488500QuadProcess {
    const destination = ((): RoomPosition | null => {
      if (state.destination == null) {
        return null
      }
      return decodeRoomPosition(state.destination)
    })()
    return new Season1488500QuadProcess(state.l, state.i, state.p, destination, state.quadState)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName): Season1488500QuadProcess {
    const quadState: QuadState = {
      creepNames: [],
      moveToTarget: null,
    }
    return new Season1488500QuadProcess(Game.time, processId, parentRoomName, null, quadState)
  }

  public processShortDescription(): string {
    return roomLink(this.parentRoomName)
  }

  public didReceiveMessage(message: string): string {
    const [rawX, rawY] = message.split(" ")
    if (rawX == null || rawY == null) {
      return `Invalid format. Expected: "x y" (${message})`
    }
    const x = parseInt(rawX, 10)
    const y = parseInt(rawY, 10)
    if (isNaN(x) === true || isNaN(y) === true) {
      return `Invalid format. Position is not a number ${message}`
    }
    try {
      this.destination = new RoomPosition(x, y, this.parentRoomName)
    } catch (e) {
      return `Failed: ${e}`
    }
    return "ok"
  }

  public runOnTick(): void {
    const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)
    creeps.forEach(creep => {
      if (this.quadState.creepNames.includes(creep.name) !== true) {
        this.quadState.creepNames.push(creep.name)
      }
    })

    const creepInsufficiency = 4 - this.quadState.creepNames.length
    if (creepInsufficiency > 0) {
      const room = Game.rooms[this.parentRoomName]
      if (room == null) {
        PrimitiveLogger.fatal(`${this.identifier} ${roomLink(this.parentRoomName)} lost`)
      } else {
        const priority: CreepSpawnRequestPriority = CreepSpawnRequestPriority.High //this.quadState.creepNames.length <= 0 ? CreepSpawnRequestPriority.Low : CreepSpawnRequestPriority.High
        this.requestCreep(priority, creepInsufficiency)
      }
    }

    if (this.quadState.creepNames.length > 0) {
      const moveToTarget = ((): RoomName | RoomPosition | null => {
        if (this.quadState.moveToTarget == null) {
          return null
        }
        if (typeof this.quadState.moveToTarget === "string") {
          return this.quadState.moveToTarget
        }
        return decodeRoomPosition(this.quadState.moveToTarget)
      })()
      const quad = new Quad(this.quadState.creepNames, moveToTarget)
      if (quad.numberOfCreeps > 0) {
        this.runQuad(quad)
        return
      }
      processLog(this, "Quad dead")
      return
    }
  }

  private requestCreep(priority: CreepSpawnRequestPriority, numberOfCreeps: number): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority,
      numberOfCreeps,
      codename: this.codename,
      roles: [CreepRole.Mover],
      body: [TOUGH, MOVE],
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runQuad(quad: Quad): void {
    if (this.destination == null) {
      quad.align()
      return
    }

    quad.moveQuadTo(this.destination, 0)
  }
}

function quadCostcallback(roomName: RoomName, costMatrix: CostMatrix): CostMatrix {
  const room = Game.rooms[roomName]
  if (room == null) {
    return costMatrix
  }

  const walkableTerrains: Terrain[] = ["swamp", "plain"]
  for (let y = 0; y < GameConstants.room.edgePosition.max; y += 1) {
    for (let x = 0; x < GameConstants.room.edgePosition.max; x += 1) {
      const position = new RoomPosition(x, y, roomName)
      const isWalkable = position.look().some(obj => (obj.type === LOOK_TERRAIN && obj.terrain != null && walkableTerrains.includes(obj.terrain)))
      if (isWalkable === true) {
        continue
      }
      position.neighbours().forEach(p => {
        costMatrix.set(p.x, p.y, OBSTACLE_COST)
      })
    }
  }

  return costMatrix
}
