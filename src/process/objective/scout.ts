import { MessageObserver } from "os/infrastructure/console_command/message_command"
import { Procedural, ProcessId } from "process/process"
import { CreepProvider, CreepProviderCreepSpec, CreepProviderDelegate } from "./creep_provider"
import { Objective } from "./objective"

interface ScoutObjectiveMemory {
  b: string             // base room name
  t: string[]           // target room name // TODO: 自身で算出する
  c: string[]           // creep IDs
}

/**
 * - 目的
 *   - 指定されたroomの周囲を探索し、signする
 */
export class ScoutObjective implements Objective, Procedural, MessageObserver, CreepProviderDelegate {
  public readonly shouldStore = true

  private readonly creepProvider: CreepProvider
  private readonly targetRoomNames: string[]
  private creepIds: string[]

  public constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    readonly roomName: string,
    targetRoomNames: string[],
    creepIds: string[],
  ) {
    this.targetRoomNames = targetRoomNames
    this.creepIds = creepIds
    this.creepProvider = new CreepProvider(this, roomName)
  }

  // ---- Stateful Process ---- //
  public static parseState(rawState: unknown): ScoutObjectiveMemory | null {
    const state = rawState as ScoutObjectiveMemory
    if (typeof state.b !== "string") {
      return null
    }
    return {
      b: state.b,
      t: state.t || [],
      c: state.c || [],
    }
  }

  public encode(): ScoutObjectiveMemory {
    return {
      b: this.roomName,
      t: this.targetRoomNames,
      c: this.creepIds,
    }
  }

  // ---- Procedural ---- //
  public runOnTick(): void {
    if (this.creepIds.length <= 0) {
      this.requestCreep()
      return
    }

    const deadCreepIds: string[] = []
    this.creepIds.forEach(creepId => {
      const creep = Game.getObjectById(creepId)
      if (creep instanceof Creep) {
        this.scoutRoom(creep)
      } else {
        deadCreepIds.push(creepId)
      }
    })
    this.creepIds = this.creepIds.filter(creepId => deadCreepIds.includes(creepId) !== true)
  }

  private requestCreep(): void {
    const scoutBodyParts = new Map<BodyPartConstant, number>()
    scoutBodyParts.set(MOVE, 1)
    const creepSpec: CreepProviderCreepSpec = {
      specType: "",
      priority: 0,
      targetRoomName: this.roomName,
      bodyParts: scoutBodyParts,
    }
    this.creepProvider.requestCreeps(creepSpec, 1)
  }

  private scoutRoom(scout: Creep): void {
    const room = scout.room
    if (room.controller != null && room.controller.sign?.username !== Game.user.name) {
      this.signController(scout, room.controller)
    } else {
      this.moveToNextRoom(scout)
    }
  }

  private signController(scout: Creep, controller: StructureController): void {

  }

  private moveToNextRoom(scout: Creep): void {

  }

  // ---- MessageObserver ---- //
  public didReceiveMessage(message: string): string {
    this.targetRoomNames.push(...message.split(","))
    return `ScoutObjective received room names ${message}`
  }

  // ---- CreepProviderDelegate ---- //
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public didProvideCreep(creep: Creep, specType: string, elapsedTime: number): void {
    this.creepIds.push(creep.id)
  }
}
