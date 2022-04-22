import { Process } from "../process/process"
import { } from "../process/owned_room_process/owned_room_process"
import { } from "../process/temporary/v8_test_process"
import { } from "../process/owned_room_process/owned_room_test_process"

export const LaunchProcessCommand = {
  launch<T>(processType: string, parentProcess: Process<T>, args: string[]): anypro | string {
    return "not implemented yet"
  },
}
