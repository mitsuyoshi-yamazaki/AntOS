export class SemanticVersion {
  public constructor(
    public readonly major: number,
    public readonly minor: number,
    public readonly patch: number,
  ) {
  }

  public toString(): string {
    return `v${this.major}.${this.minor}.${this.patch}`
  }

  /** @throws */
  public static decode(versionString: string): SemanticVersion {
    const components = versionString.split(".")
    if (components.length !== 3 || components[0] == null || components[1] == null || components[2] == null) {
      throw `Unexpected format (${versionString})`
    }

    const major = parseBase10(components[0].replace("v", ""))
    const minor = parseBase10(components[1])
    const patch = parseBase10(components[2])

    return new SemanticVersion(major, minor, patch)
  }

  public isMajorVersionHigherThan(other: SemanticVersion): boolean {
    if (this.major > other.major) {
      return true
    }
    return false
  }

  public isMinorVersionHigherThan(other: SemanticVersion): boolean {
    if (this.major > other.major) {
      return true
    }
    if (this.major < other.major) {
      return false
    }

    if (this.minor > other.minor) {
      return true
    }
    return false
  }

  public isLargerThan(other: SemanticVersion): boolean {
    if (this.major > other.major) {
      return true
    }
    if (this.major < other.major) {
      return false
    }

    if (this.minor > other.minor) {
      return true
    }
    if (this.minor < other.minor) {
      return false
    }

    if (this.patch > other.patch) {
      return true
    }
    return false
  }

  public isEqualTo(other: SemanticVersion): boolean {
    return this.major === other.major && this.minor === other.minor && this.patch === other.patch
  }
}

/** @throws */
const parseBase10 = (value: string): number => {
  const numberValue = parseInt(value, 10)
  if (isNaN(numberValue)) {
    throw `${value} is not a number`
  }
  return numberValue
}
