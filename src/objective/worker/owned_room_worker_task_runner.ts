import { TaskRunner } from "objective/task_runner"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { EnergyChargeableStructure } from "prototype/room_object"
import { TransferEnergyApiWrapper } from "task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { UpgradeControllerApiWrapper } from "task/creep_task/api_wrapper/upgrade_controller_api_wrapper"
import { MoveHarvestEnergyTask } from "task/creep_task/conbined_task/move_harvest_energy_task"
import { MoveToTargetTask } from "task/creep_task/conbined_task/move_to_target_task"
import { CreepTask } from "task/creep_task/creep_task"
import { creepPoolAssignPriorityLow } from "world_info/resource_pool/creep_resource_pool"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"

export class OwnedRoomWorkTaskRunner implements TaskRunner {
  public constructor(
    public readonly objects: OwnedRoomObjects,
  ) { }

  public run(): void {
    const necessaryRoles: CreepRole[] = [CreepRole.Worker, CreepRole.Mover]

    World.resourcePools.assignTasks(
      this.objects.controller.room.name,
      creepPoolAssignPriorityLow,
      (creep: Creep): CreepTask | null => {
        return this.newTaskFor(creep)
      },
      creep => hasNecessaryRoles(creep, necessaryRoles),
    )
  }

  private newTaskFor(creep: Creep): CreepTask | null {
    const noEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) < creep.store.getCapacity() / 2

    if (noEnergy) {
      const source = this.getSourceToAssign(creep.pos)
      if (source == null) {
        return null
      }
      return MoveHarvestEnergyTask.create(source)
    }

    const structureToCharge = this.getStructureToCharge(creep.pos)
    if (structureToCharge != null) {
      return MoveToTargetTask.create(TransferEnergyApiWrapper.create(structureToCharge))
    }

    // const damagedStructure = this.getRepairStructureToAssign()
    // if (damagedStructure != null) {
    //   creep.v4Task = new RepairTask(Game.time, damagedStructure)
    // } else {
    //   const constructionSite = this.getConstructionSiteToAssign(constructionSites)
    //   if (constructionSite != null) {
    //     creep.v4Task = new BuildTask(Game.time, constructionSite)
    //   } else {
    //   }
    // }

    return MoveToTargetTask.create(UpgradeControllerApiWrapper.create(this.objects.controller))
  }

  private getSourceToAssign(position: RoomPosition): Source | null {
    const sources = this.objects.sources
    if (sources.length <= 0) {
      return null
    }
    return sources.reduce((lhs, rhs) => {
      const lTargetedBy = lhs.targetedBy.length
      const rTargetedBy = rhs.targetedBy.length
      if (lTargetedBy === rTargetedBy) {
        return lhs.pos.getRangeTo(position) < rhs.pos.getRangeTo(position) ? lhs : rhs
      }
      return lTargetedBy < rTargetedBy ? lhs : rhs
    })
  }

  private getStructureToCharge(position: RoomPosition): EnergyChargeableStructure | null {
    const chargeableStructures = this.objects.activeStructures.chargeableStructures
    if (chargeableStructures.length <= 0) {
      return null
    }
    return chargeableStructures.reduce((lhs, rhs) => {
      const lTargetedBy = lhs.targetedBy.length
      const rTargetedBy = rhs.targetedBy.length
      if (lTargetedBy === rTargetedBy) {
        return lhs.pos.getRangeTo(position) < rhs.pos.getRangeTo(position) ? lhs : rhs
      }
      return lTargetedBy < rTargetedBy ? lhs : rhs
    })
  }

  // private getConstructionSiteToAssign(constructionSites: ConstructionSite<BuildableStructureConstant>[]): ConstructionSite<BuildableStructureConstant> | null {
  //   const storedConstructionSite = ((): ConstructionSite<BuildableStructureConstant> | null => {
  //     if (this.buildingConstructionSiteId == null) {
  //       return null
  //     }
  //     return Game.getObjectById(this.buildingConstructionSiteId)
  //   })()
  //   if (storedConstructionSite != null) {
  //     return storedConstructionSite
  //   }

  //   const constructionSite = constructionSites[0]
  //   this.buildingConstructionSiteId = constructionSite?.id
  //   return constructionSite
  // }

  // private getRepairStructureToAssign(): AnyStructure | null {
  //   return this.objects.damagedStructures[0] ?? null
  // }
}
