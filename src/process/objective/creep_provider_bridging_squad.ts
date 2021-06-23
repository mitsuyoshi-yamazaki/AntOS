import { UID } from "../../utility"
import { Squad, SquadType, SpawnPriority, SpawnFunction, SquadMemory } from "old/squad/squad"
import { CreepStatus, CreepType } from "old/creep"
import { CreepProviderCreepSpec } from "./creep_provider"

let requestCacheTime = 0
const squadNames = new Map<string, string>()

export function requestCreep(spec: CreepProviderCreepSpec, count: number, roomName: string): void {
  if (requestCacheTime !== Game.time) {
    squadNames.clear()
    for (const squadName in Memory.squads) {
      const squadMemory = Memory.squads[squadName]
      if (squadMemory.type !== SquadType.CREEP_PROVIDER_BRIDGING_SQUAD) {
        continue
      }
      const squadRoomName = squadMemory.owner_name
      squadNames.set(squadRoomName, squadName)
    }
    requestCacheTime = Game.time
  }
  const squadName = squadNames.get(roomName)
  if (squadName == null) {
    console.log(`CreepProviderBridgingSquad in room ${roomName} not found`)
    return
  }
  const memory = Memory.squads[squadName] as CreepProviderBridgingSquadMemory | null
  if (memory == null) {
    console.log(`CreepProviderBridgingSquad ${squadName} memory not found`)
    return
  }
  memory.req += count
}

let newCreepCacheTime = 0
const newCreeps = new Map<string, Creep[]>()

export function getNewCreepsIn(roomName: string, bridgingId: string): Creep[] { // TODO: どのrequirementに対するCreepか判別できるようにする
  if (newCreepCacheTime !== Game.time) {
    newCreeps.clear()
    for (const creepName in Game.creeps) {
      const creep = Game.creeps[creepName]
      if (creep.memory.type !== CreepType.CREEP_PROVIDER) {
        continue
      }
      if (creep.memory.squad_name.length === 0) {
        continue
      }
      const creeps = newCreeps.get(creep.room.name) ?? []
      creeps.push(creep)
      newCreeps.set(creep.room.name, creeps)
    }
    newCreepCacheTime = Game.time
  }

  return newCreeps.get(roomName) ?? []
}

// -------- //
export interface CreepProviderBridgingSquadMemory extends SquadMemory {
  req: number // number of scouts required
}

/**
 * - [ ] Scout以外のCreepに対応する
 */
export class CreepProviderBridgingSquad extends Squad {
  public get type(): SquadType {
    return SquadType.CREEP_PROVIDER_BRIDGING_SQUAD
  }
  public get spawnPriority(): SpawnPriority {
    if (this.memory == null) {
      return SpawnPriority.NONE
    }
    const required = this.memory.req > 0
    return required ? SpawnPriority.LOW : SpawnPriority.NONE
  }

  private get memory(): CreepProviderBridgingSquadMemory | null {
    return Memory.squads[this.name] as CreepProviderBridgingSquadMemory | null
  }

  constructor(readonly name: string, readonly base_room: Room) {
    super(name, base_room)
  }

  public static need_instantiation(): boolean {
    return true
  }

  public static generateNewName(): string {
    return UID(SquadType.CREEP_PROVIDER_BRIDGING_SQUAD)
  }

  public generateNewName(): string {
    return CreepProviderBridgingSquad.generateNewName()
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public hasEnoughEnergy(energyAvailable: number, capacity: number): boolean {
    return energyAvailable >= 50
  }

  public addCreep(energyAvailable: number, spawnFunc: SpawnFunction): void {
    const body: BodyPartConstant[] = [MOVE]
    const name = this.generateNewName()
    const memory: CreepMemory = {
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.CREEP_PROVIDER,
      should_notify_attack: false,
      let_thy_die: true,
    }

    const result = spawnFunc(body, name, {
      memory: memory
    })

    if (result !== OK) {
      console.log(`CreepProviderBridgingSquadMemory spawn scout failed with error: ${result}`)
    }
  }

  public run(): void {
    // do nothing
  }
}
