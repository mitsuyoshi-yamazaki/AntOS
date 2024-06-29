import { reverseConstMapping } from "shared/utility/strict_entries"

const bodyPartEncodingMap = {
  w: WORK,
  a: ATTACK,
  ra: RANGED_ATTACK,
  h: HEAL,
  c: CARRY,
  cl: CLAIM,
  m: MOVE,
  t: TOUGH,
} as const
const bodyPartDecodingMap = reverseConstMapping(bodyPartEncodingMap)

export class CreepBody {
  public get stringRepresentation(): string {
    if (this._stringRepresentation == null) {
      this._stringRepresentation = this.getStringRepresentation()
    }
    return this._stringRepresentation
  }
  private _stringRepresentation: string | null = null


  private constructor(
    public readonly bodyParts: BodyPartConstant[]
  ) {
  }

  public static createWithBodyParts(bodyParts: BodyPartConstant[]): CreepBody {
    return new CreepBody(bodyParts)
  }

  /**
   * @throws
   * @param body {parts count}{parts type}... ex: 3w3c6m
   */
  public static createFromTextRepresentation(input: string): CreepBody {
    return new CreepBody(parseEncodedCreepBody(input))
  }


  // Private
  private getStringRepresentation(): string {
    const consecutiveBodyParts: {count: number, body: BodyPartConstant}[] = []
    let currentBody: { count: number, body: BodyPartConstant } | null = null

    this.bodyParts.forEach(body => {
      if (currentBody == null) {
        currentBody = {
          count: 1,
          body,
        }
        return
      }

      if (currentBody.body !== body) {
        consecutiveBodyParts.push(currentBody)
        currentBody = {
          count: 1,
          body,
        }
        return
      }

      currentBody.count += 1
    })

    if (currentBody != null) {
      consecutiveBodyParts.push(currentBody)
    }

    return consecutiveBodyParts.map(body => `${body.count}${bodyPartDecodingMap[body.body]}`).join()
  }
}


/** @throws */
const parseEncodedCreepBody = (input: string): BodyPartConstant[] => {
  const result: [number, string][] = []
  const regex = /(\d+)([a-zA-Z]+)/g
  let match: RegExpExecArray | null = null

  while ((match = regex.exec(input)) !== null) {
    if (match[1] == null || match[2] == null) {
      throw `Input string "${input}" is not number & string pair`
    }
    const numberPart = parseInt(match[1], 10)
    const stringPart = match[2]
    result.push([numberPart, stringPart])
  }

  return result.flatMap(([count, encodedBodyPart], index): BodyPartConstant[] => {
    const bodyPart = (bodyPartEncodingMap as Record<string, BodyPartConstant>)[encodedBodyPart.toLowerCase()]
    if (bodyPart == null) {
      throw `Invalid body part specifier ${encodedBodyPart} (in ${input} at ${index})`
    }
    return new Array(count).map(_ => bodyPart)
  })
}
