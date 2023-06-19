import { Process, ProcessId } from "../process";
import { SystemCall } from "../system_call";

type RespawnBootstrapRoomProcessDriver = never
export class RespawnBootstrapRoomProcess extends Process<RespawnBootstrapRoomProcessDriver> {
  public readonly processId: ProcessId<this>

  public constructor(
    systemCall: SystemCall,
    drivers: DriverSet<RespawnBootstrapRoomProcessDriver>,
  ) {
    super(systemCall, drivers)
  }

  public run(): void {

  }
}
