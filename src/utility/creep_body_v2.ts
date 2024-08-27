import { reverseConstMapping } from "shared/utility/strict_entries"
import { GameConstants } from "./constants"

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


export type CreepBodyStringRepresentation = string & { readonly idType: unique symbol }

// TODO: キャッシュを入れる
export class CreepBody {
  public get stringRepresentation(): CreepBodyStringRepresentation {
    if (this._stringRepresentation == null) {
      this._stringRepresentation = this.getStringRepresentation()
    }
    return this._stringRepresentation
  }


  public get energyCost(): number {
    if (this._energyCost == null) {
      this._energyCost = this.bodyParts.reduce((result, current) => {
        return result + BODYPART_COST[current]
      }, 0)
    }
    return this._energyCost
  }
  private _energyCost: number | null = null


  private constructor(
    public readonly bodyParts: BodyPartConstant[],
    private _stringRepresentation: CreepBodyStringRepresentation | null,
  ) {
  }

  // TODO: bodyが空等の場合はthrowする
  public static createWithBodyParts(bodyParts: BodyPartConstant[]): CreepBody {
    return new CreepBody(bodyParts, null)
  }

  /** @throws */
  public static createWith(baseBody: BodyPartConstant[], unit: BodyPartConstant[], unitMaxCount: number, energyCapacity: number): CreepBody {
    // TODO: パーツの並び替え
    const body: BodyPartConstant[] = [...baseBody]

    const baseCost = bodyCost(baseBody)
    const unitCost = bodyCost(unit)

    const maxCountBasedOnEnergy = Math.floor((energyCapacity - baseCost) / unitCost)
    const maxCountBasedOnBody = Math.floor((GameConstants.creep.body.bodyPartMaxCount - baseBody.length) / unit.length)
    const maxCount = Math.min(maxCountBasedOnEnergy, maxCountBasedOnBody, unitMaxCount)

    for (let i = 0; i < maxCount; i += 1) {
      body.unshift(...unit)
    }
    return new CreepBody(body, null)
  }

  /**
   * @throws
   * @param body {parts count}{parts type}... ex: 3w3c6m
   */
  public static createFromRawStringRepresentation(input: string): CreepBody {
    return new CreepBody(parseEncodedCreepBody(input), input as CreepBodyStringRepresentation)
  }

  public static createFromStringRepresentation(input: CreepBodyStringRepresentation): CreepBody {
    return new CreepBody(parseEncodedCreepBody(input), input)
  }

  // Private
  private getStringRepresentation(): CreepBodyStringRepresentation {
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

    const stringRepresentation = consecutiveBodyParts.map(body => `${body.count}${bodyPartDecodingMap[body.body]}`).join("").toUpperCase()
    return stringRepresentation as CreepBodyStringRepresentation
  }

  public toString(): string {
    return this.stringRepresentation
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

  const body = result.flatMap(([count, encodedBodyPart], index): BodyPartConstant[] => {
    const bodyPart = (bodyPartEncodingMap as Record<string, BodyPartConstant>)[encodedBodyPart.toLowerCase()]
    if (bodyPart == null) {
      throw `Invalid body part specifier ${encodedBodyPart} (in ${input} at ${index})`
    }
    return new Array(count).fill(bodyPart)
  })

  if (body.length <= 0) {
    throw `No body parts for ${input}`
  }

  return body
}

const bodyCost = (body: BodyPartConstant[]): number => {
  return body.reduce((result, current) => {
    return result + BODYPART_COST[current]
  }, 0)
}
