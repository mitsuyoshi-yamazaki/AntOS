import { AnyProcessId, Process, processDefaultIdentifier, ProcessDefaultIdentifier, ProcessDependencies, ProcessId } from "../../../process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { AnyV5Creep, AnyV5CreepMemory, ExtendedV5CreepMemory, isSpawnedV5Creep, isV5CreepMemory, V5Creep, V5CreepMemory, V5SpawnedCreep } from "os_v5/utility/game_object/creep"
import { EmptySerializable, SerializableObject } from "os_v5/utility/types"
import { ValuedArrayMap } from "shared/utility/valued_collection"
import { CreepName } from "prototype/creep"
import { strictEntries } from "shared/utility/strict_entries"
import { Mutable } from "shared/utility/types"

/**
#
## 概要
- このOSが管理するCreepを各Processへ配分する

## 仕様
- Process IDで見分ける

## Discussion
- memhackの適用下でもゲームシステムが入力するメモリ内容は取得できるのか？
 */

ProcessDecoder.register("CreepDistributorProcess", (processId: CreepDistributorProcessId) => CreepDistributorProcess.decode(processId))


export type CreepDistributorProcessApi = {
  countCreepsFor(processId: AnyProcessId): number
  getCreepsFor<M extends SerializableObject>(processId: AnyProcessId): V5Creep<M>[]
  getSpawnedCreepsFor<M extends SerializableObject>(processId: AnyProcessId): V5SpawnedCreep<M>[]
  getDeadCreepsFor(processId: AnyProcessId): CreepName[]
  getDeadCreeps(): CreepName[]
  getUnallocatedCreeps(): AnyV5Creep[]
  createSpawnCreepMemoryFor<M extends SerializableObject>(processId: AnyProcessId, memory: ExtendedV5CreepMemory<M>): V5CreepMemory<M>
}


export type CreepDistributorProcessId = ProcessId<void, ProcessDefaultIdentifier, CreepDistributorProcessApi, EmptySerializable, CreepDistributorProcess>


export class CreepDistributorProcess extends Process<void, ProcessDefaultIdentifier, CreepDistributorProcessApi, EmptySerializable, CreepDistributorProcess> {
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [],
  }

  private readonly v5Creeps = new ValuedArrayMap<AnyProcessId | null, AnyV5Creep>()
  private readonly deadCreepNames = new ValuedArrayMap<AnyProcessId | null, CreepName>()

  private constructor(
    public readonly processId: CreepDistributorProcessId,
  ) {
    super()
  }

  public encode(): EmptySerializable {
    return {
    }
  }

  public static decode(processId: CreepDistributorProcessId): CreepDistributorProcess {
    return new CreepDistributorProcess(processId)
  }

  public static create(processId: CreepDistributorProcessId): CreepDistributorProcess {
    return new CreepDistributorProcess(processId)
  }

  public getDependentData(): void { }

  public staticDescription(): string {
    const creepCount = [...this.v5Creeps.values()].flatMap(x => x).length
    return `${creepCount} v5 creeps`
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(): CreepDistributorProcessApi {
    this.v5Creeps.clear()
    this.deadCreepNames.clear()

    const creepMemories = (strictEntries(Memory.creeps) as [string, CreepMemory][])
    creepMemories.forEach(([creepName, creepMemory]) => {
      if (!isV5CreepMemory(creepMemory)) {
        return
      }
      const v5CreepMemory: AnyV5CreepMemory = creepMemory
      const v5Creep = Game.creeps[creepName] as AnyV5Creep | undefined
      if (v5Creep == null) {
        this.deadCreepNames.getValueFor(v5CreepMemory.p).push(creepName)
        delete Memory.creeps[creepName]
        return
      }
      (v5Creep as Mutable<AnyV5Creep>).executedActions = new Set()
      this.v5Creeps.getValueFor(v5Creep.memory.p).push(v5Creep)
    })

    return {
      countCreepsFor: (processId: AnyProcessId): number => {
        return this.v5Creeps.get(processId)?.length ?? 0
      },

      getCreepsFor: <M extends SerializableObject>(processId: AnyProcessId): V5Creep<M>[] => {
        return [...this.v5Creeps.getValueFor(processId)] as V5Creep<M>[]
      },

      getSpawnedCreepsFor: <M extends SerializableObject>(processId: AnyProcessId): V5SpawnedCreep<M>[] => {
        return (this.v5Creeps.getValueFor(processId) as V5Creep<M>[]).filter(isSpawnedV5Creep)
      },

      getDeadCreepsFor: (processId: AnyProcessId): CreepName[] => {
        return [...this.deadCreepNames.getValueFor(processId)]
      },

      getDeadCreeps: (): CreepName[] => {
        return [...this.deadCreepNames.values()].flatMap(x => x)
      },

      getUnallocatedCreeps: (): AnyV5Creep[] => {
        return [...this.v5Creeps.getValueFor(null)]
      },

      createSpawnCreepMemoryFor: <M extends SerializableObject>(processId: AnyProcessId, memory: ExtendedV5CreepMemory<M>): V5CreepMemory<M> => {
        return {
          v: "o5",  // TODO:
          p: processId,
          ...memory,
        }
      },
    }
  }
}
