import { TaskRunner, TaskRunnerIdentifier } from "objective/task_runner"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { EnergyChargeableStructure } from "prototype/room_object"
import { BuildApiWrapper } from "task/creep_task/api_wrapper/build_api_wrapper"
import { RepairApiWrapper } from "task/creep_task/api_wrapper/repair_api_wrapper"
import { TransferEnergyApiWrapper } from "task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { UpgradeControllerApiWrapper } from "task/creep_task/api_wrapper/upgrade_controller_api_wrapper"
import { MoveHarvestEnergyTask } from "task/creep_task/combined_task/move_harvest_energy_task"
import { MoveToTargetTask } from "task/creep_task/combined_task/move_to_target_task"
import { CreepTask } from "task/creep_task/creep_task"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"

export class OwnedRoomWorkTaskRunner implements TaskRunner {
  public readonly taskRunnerIdentifier: TaskRunnerIdentifier

  public constructor(
    public readonly objects: OwnedRoomObjects,
  ) {
    this.taskRunnerIdentifier = `${this.constructor.name}_${this.objects.controller.room.name}`
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public run(objects: OwnedRoomObjects): void {
    const necessaryRoles: CreepRole[] = [CreepRole.Worker, CreepRole.Mover]

    World.resourcePools.assignTasks(
      this.objects.controller.room.name,
      null,
      CreepPoolAssignPriority.Low,
      (creep: Creep): CreepTask | null => {
        return this.newTaskFor(creep)
      },
      creep => hasNecessaryRoles(creep, necessaryRoles),
    )
  }

  private newTaskFor(creep: Creep): CreepTask | null {
    const noEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0

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

    const damagedStructure = this.getRepairStructureToAssign()
    if (damagedStructure != null) {
      return MoveToTargetTask.create(RepairApiWrapper.create(damagedStructure))
    }
    const constructionSite = this.getConstructionSiteToAssign()
    if (constructionSite != null) {
      return MoveToTargetTask.create(BuildApiWrapper.create(constructionSite))
    }

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

  private getConstructionSiteToAssign(): ConstructionSite<BuildableStructureConstant> | null {
    const constructionSites: ConstructionSite<BuildableStructureConstant>[] = this.objects.constructionSites
    return constructionSites[0]
  }

  private getRepairStructureToAssign(): AnyStructure | null {
    return this.objects.damagedStructures[0]
  }
}
