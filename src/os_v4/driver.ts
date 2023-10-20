import { SystemCallSet } from "./system_call_set"

export abstract class Driver<Name extends string, D extends (AnyDriver | never)> {
  public abstract readonly name: Name

  public constructor(
    protected readonly systemCallSet: typeof SystemCallSet,
    protected readonly drivers: DriverSet<D>,
  ) {
  }

  public load(): void {
  }

  public startOfTick(): void {
  }

  public endOfTick(): void {
  }
}

export abstract class TransportManagerInterface extends Driver<"transport_manager", never> { }

export type AnyDriver = TransportManagerInterface
export type DriverName = AnyDriver["name"]
export type GenericDriver<Name extends DriverName> = Name extends "transport_manager" ? TransportManagerInterface : never

export type DriverSet<D extends AnyDriver> = Readonly<{ [K in D["name"]]: GenericDriver<K> }>
