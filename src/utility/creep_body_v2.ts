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
