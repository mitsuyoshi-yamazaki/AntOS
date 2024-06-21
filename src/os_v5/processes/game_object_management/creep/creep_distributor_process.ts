import { AnyProcessId, Process, ProcessDependencies, ProcessId } from "../../../process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { AnyV5Creep, AnyV5CreepMemory, ExtendedV5CreepMemory, isV5Creep, isV5CreepMemory, V5Creep, V5CreepMemory } from "os_v5/utility/game_object/creep"
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
  getCreepsFor<M extends SerializableObject>(processId: AnyProcessId): V5Creep<M>[]
  getDeadCreepsFor(processId: AnyProcessId): CreepName[]
  getDeadCreeps(): CreepName[]
  getUnallocatedCreeps(): AnyV5Creep[]
  createSpawnCreepMemoryFor<M extends SerializableObject>(processId: AnyProcessId, memory: ExtendedV5CreepMemory<M>): V5CreepMemory<M>
}


export type CreepDistributorProcessId = ProcessId<void, "CreepDistributor", CreepDistributorProcessApi, EmptySerializable, CreepDistributorProcess>


export class CreepDistributorProcess extends Process<void, "CreepDistributor", CreepDistributorProcessApi, EmptySerializable, CreepDistributorProcess> {
  public readonly identifier = "CreepDistributor"
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

    ;
    (strictEntries(Memory.creeps) as [string, CreepMemory][]).forEach(([creepName, creepMemory]) => {
      if (!isV5CreepMemory(creepMemory)) {
        return
      }
      const v5CreepMemory: AnyV5CreepMemory = creepMemory
      const v5Creep = Game.creeps[creepName] as AnyV5Creep | undefined
      if (v5Creep == null) {
        this.deadCreepNames.getValueFor(v5CreepMemory.p).push(creepName)
        return
      }
      (v5Creep as Mutable<AnyV5Creep>).executedActions = new Set()
      this.v5Creeps.getValueFor(v5Creep.memory.p).push(v5Creep)
    })

    return {
      getCreepsFor: <M extends SerializableObject>(processId: AnyProcessId): V5Creep<M>[] => {
        return [...this.v5Creeps.getValueFor(processId)] as V5Creep<M>[]
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
