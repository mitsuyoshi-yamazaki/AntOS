import { TransportManager } from "./driver/transport_manager"
import { OperatingSystem } from "./os"

export type ScreepsDrivers = TransportManager

export class ScreepsOS extends OperatingSystem<ScreepsDrivers> {
  public readonly name = "AntOS"
}
