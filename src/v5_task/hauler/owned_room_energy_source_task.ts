import { EnergySource } from "prototype/room_object"
import { Task } from "v5_task/task"

export abstract class EnergySourceTask extends Task {
  abstract energySources: EnergySource[]
  abstract energyCapacity: number
}
