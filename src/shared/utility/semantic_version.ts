export class SemanticVersion {
  public constructor(
    public readonly major: number,
    public readonly minor: number,
    public readonly patch: number,
  ) {
  }

  public toString(): string {
    return `${this.major}.${this.minor}.${this.patch}`
  }
}
