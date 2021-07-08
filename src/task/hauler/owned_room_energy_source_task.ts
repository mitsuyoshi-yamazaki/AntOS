import { EnergySource } from "prototype/room_object"
import { Task } from "task/task"

export abstract class EnergySourceTask extends Task {
  abstract energySources: EnergySource[]
}
