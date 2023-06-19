import { SystemCall } from "./system_call"

export abstract class Driver<Name extends string, D extends (AnyDriver | never)> {
  public abstract readonly name: Name

  public constructor(
    private readonly systemCall: SystemCall,
    private readonly drivers: DriverSet<D>,
  ) {
  }

  public load(): void {
  }

  public startOfTick(): void {
  }

  public endOfTick(): void {
  }
}

class DemoDriver1 extends Driver<"demo1", never> {
  readonly name = "demo1"
}

class DemoDriver2 extends Driver<"demo2", never> {
  readonly name = "demo2"
}

export type AnyDriver = DemoDriver1 | DemoDriver2
export type DriverName = AnyDriver["name"]
export type GenericDriver<Name extends DriverName> = Name extends "demo1" ? DemoDriver1 : DemoDriver2

export type DriverSet<D extends AnyDriver> = Readonly<{ [K in D["name"]]: GenericDriver<K> }>
