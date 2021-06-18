export interface SystemInformation {
}

export class OperatingSystem {
  public constructor(
    public readonly systemInformation: SystemInformation,
  ) {
  }

  public run(): void {
    console.log("OS running")
  }
}
