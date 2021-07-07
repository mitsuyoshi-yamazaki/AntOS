import { EnergySource } from "prototype/room_object"
import { Task } from "task/task"

export abstract class OwnedRoomEnergySourceTask extends Task {
  abstract energySources: EnergySource[]
}
