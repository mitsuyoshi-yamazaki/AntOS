type Driver<Name extends string> = {
  readonly name: Name
}

type MemoryDriver = Driver<"memory"> & {
}
type CpuDriver = Driver<"cpu"> & {
}
type DatetimeDriver = Driver<"datetime"> & {
}

type AnyDriver = MemoryDriver | CpuDriver | DatetimeDriver
type DriverName = AnyDriver["name"]
type GenericDriver<Name extends DriverName> = Name extends "memory" ? MemoryDriver :
  Name extends "cpu" ? CpuDriver :
  DatetimeDriver

type DriverSet<D extends AnyDriver> = Readonly<{ [K in D["name"]]: GenericDriver<K> }>

type Process<D extends AnyDriver> = {
  run(drivers: DriverSet<D>)
}

// ---- ---- //

const memoryDriver: MemoryDriver = {
  name: "memory"
}
const cpuDriver: CpuDriver = {
  name: "cpu"
}

// ---- ---- //

type SavannaDriver = MemoryDriver | CpuDriver
const savannaDriverSet: DriverSet<SavannaDriver> = {
  memory: memoryDriver,
  cpu: cpuDriver,
}

class LionProcess implements Process<MemoryDriver> {
  run(drivers: DriverSet<MemoryDriver>) {
  }
}

class ZebraProcess implements Process<CpuDriver> {
  run(drivers: DriverSet<CpuDriver>) {
  }
}

type GiraffeDependencies = MemoryDriver | CpuDriver
class GiraffeProcess implements Process<GiraffeDependencies> {
  run(drivers: DriverSet<GiraffeDependencies>) {
  }
}
