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
 *   - W53S29,W53S28,W53S27
 *   - Object.keys(Game.creeps).filter(name => Game.creeps[name].room.name === "W51S29" && name.includes("creep_provider_bridging_squad")).map(name => Game.creeps[name]).forEach(creep => creep.say("Hi"))
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
    this.creepProvider.run()

    if (this.creepIds.length <= 0 && this.creepProvider.requestingCreepsFor(this.processId) <= 0) {
      this.requestCreep()
      return
    }

    const deadCreepIds: string[] = []
    this.creepIds.forEach(creepId => {
      const creep = Game.getObjectById(creepId)
      if (creep instanceof Creep) {
        this.scoutRoom(creep)
      } else {
        console.log(`dead creep ${creep}`)
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

  private getNextRoomName(currentRoomName: string): string | null {
    if (this.targetRoomNames.length <= 0) {
      return null
    }
    const currentRoomIndex = this.targetRoomNames.indexOf(currentRoomName)
    if (currentRoomIndex < 0) {
      return this.targetRoomNames[0]
    }
    return this.targetRoomNames[currentRoomIndex + 1]
  }

  private signController(creep: Creep, controller: StructureController): void {
    const sign = () => {
      const emoji = ["😆", "😄", "😐", "😴", "🤔", "🙃", "😃", "😑", "😖", "😝"]
      const index = (Number(creep.room.name.slice(1, 3)) + Number(creep.room.name.slice(4, 6))) % emoji.length
      return emoji[index]
    }
    const result = creep.signController(controller, sign())
    if (result === ERR_NOT_IN_RANGE) {
      creep.say("🏃‍♂️")
      creep.moveTo(controller)
    } else if (result < 0) {
      console.log(`sign controller error: ${result}`)
    }
  }

  private moveToNextRoom(scout: Creep): void {
    const nextRoomName = this.getNextRoomName(scout.room.name)
    if (nextRoomName == null) {
      return
    }

    scout.moveToRoom(nextRoomName)
  }

  // ---- MessageObserver ---- //
  public didReceiveMessage(message: string): string {
    this.targetRoomNames.push(...message.split(","))
    return `ScoutObjective received room names ${message}`
  }

  // ---- CreepProviderDelegate ---- //
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public didProvideCreep(creep: Creep, specType: string, elapsedTime: number): void {
    console.log(`creep ${creep.id} received`)
    this.creepIds.push(creep.id)
  }
}
