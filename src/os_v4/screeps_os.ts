import { AnyDriver } from "./driver"
import { OperatingSystem } from "./os"

type ScreepsDrivers = AnyDriver

export class ScreepsOS extends OperatingSystem<ScreepsDrivers> {
}
