import { CreepBodyBoostableActionType, CreepBodyEnergyConsumeActionType, CreepBodyFixedAmountActionType, GameConstants } from "./constants"
import { anyColoredText } from "./log"

const CreepActionToBodyPart: { [index in CreepBodyBoostableActionType]: BodyPartConstant } = {
  harvest: WORK,
  build: WORK,
  repair: WORK,
  dismantle: WORK,
  upgradeController: WORK,
  attack: ATTACK,
  rangedAttack: RANGED_ATTACK,
  rangedMassAttack: RANGED_ATTACK,
  heal: HEAL,
  rangedHeal: HEAL,
  capacity: CARRY,
  fatigue: MOVE,
  damage: TOUGH,
}

export const CreepBodyActionPower: { [index in CreepBodyFixedAmountActionType]: number } = {
  harvest: HARVEST_POWER,
  build: BUILD_POWER,
  repair: REPAIR_POWER,
  dismantle: DISMANTLE_POWER,
  upgradeController: UPGRADE_CONTROLLER_POWER,
  attack: ATTACK_POWER,
  rangedAttack: RANGED_ATTACK_POWER,
  heal: HEAL_POWER,
  capacity: CARRY_CAPACITY,
}

export const CreepBody = {
  create: function(baseBody: BodyPartConstant[], bodyUnit: BodyPartConstant[], energyCapacity: number, maxUnitCount: number): BodyPartConstant[] {
    return createCreepBody(baseBody, bodyUnit, energyCapacity, maxUnitCount)
  },

  cost: function(body: BodyPartConstant[]): number {
    return bodyCost(body)
  },

  spawnTime: function(body: BodyPartConstant[]): number {
    return body.length * GameConstants.creep.life.spawnTime
  },

  power: function(body: BodyPartDefinition[], actionType: CreepBodyFixedAmountActionType):number {
    return bodyPower(body, actionType)
  },

  actionEnergyCost: function (body: BodyPartConstant[], actionType: CreepBodyEnergyConsumeActionType): number {
    const actionCost = GameConstants.creep.actionCost
    return body.reduce((result, current) => {
      if (current !== WORK) {
        return result
      }
      return result + (actionCost[actionType] ?? 0)
    }, 0)
  },

  carryCapacity: function (body: BodyPartConstant[]): number {
    return body.filter(b => (b === CARRY)).length * GameConstants.creep.actionPower.carryCapacity
  },

  description: function (body: BodyPartConstant[]): string {
    return bodyDescription(body)
  },
}

// TODO: remove "export"
/** @deprecated */
export function bodyCost(body: BodyPartConstant[]): number {
  return body.reduce((result, current) => {
    return result + BODYPART_COST[current]
  }, 0)
}

function boostForBody(bodyPart: BodyPartDefinition, actionType: CreepBodyFixedAmountActionType): number {
  if (typeof bodyPart.boost !== "string") {
    return 1
  }
  const boostMap: { [index: string]: { [index: string]: number } } | undefined = BOOSTS[bodyPart.type]
  if (boostMap == null) {
    return 1
  }
  const actionMap = boostMap[bodyPart.boost]
  if (actionMap == null) {
    return 1
  }
  const multiply = actionMap[actionType]
  if (multiply == null) {
    return 1
  }
  return multiply
}

/** @deprecated */
export function bodyPower(body: BodyPartDefinition[], actionType: CreepBodyFixedAmountActionType): number {
  const bodyPart = CreepActionToBodyPart[actionType]
  const actionPower = CreepBodyActionPower[actionType]  // FixMe: Mineral harvestでは値が異なる

  return body.reduce((result, current) => {
    if (current.type !== bodyPart) {
      return result
    }
    if (current.hits <= 0) {
      return result
    }
    const boost = boostForBody(current, actionType)
    return result + actionPower * boost
  }, 0)
}

/** @deprecated */
export function createCreepBody(baseBody: BodyPartConstant[], bodyUnit: BodyPartConstant[], energyCapacity: number, maxUnitCount: number): BodyPartConstant[] {
  const result: BodyPartConstant[] = [...baseBody]

  const baseCost = bodyCost(baseBody)
  const unitCost = bodyCost(bodyUnit)
  const maxCount = Math.min(Math.floor((energyCapacity - baseCost) / unitCost), maxUnitCount)

  for (let i = 0; i < maxCount; i += 1) {
    result.unshift(...bodyUnit)
  }
  return result
}

const bodyShortDescription: { [index in BodyPartConstant]: string } = {
  move: "M",
  carry: "C",
  work: "W",
  tough: "T",
  attack: "A",
  ranged_attack: "RA",
  heal: "H",
  claim: "CL",
}

const bodyColors: { [index in BodyPartConstant]: string } = {
  move: "#AAB7C6",
  carry: "#777777",
  work: "#FFE76E",
  tough: "#FFFFFF",
  attack: "#F72843",
  ranged_attack: "#5E7FB2",
  heal: "#6DFF63",
  claim: "#B897F8",
}

function coloredBodyShortDescription(body: BodyPartConstant): string {
  return anyColoredText(bodyShortDescription[body], bodyColors[body])
}

/** @deprecated */
export function bodyDescription(body: BodyPartConstant[]): string {
  const map = new Map<BodyPartConstant, number>()
  body.forEach(b => {
    map.set(b, (map.get(b) ?? 0) + 1)
  })
  const result: string[] = []
  map.forEach((value, key) => {
    result.push(`<b>${value}${coloredBodyShortDescription(key)}</b>`)
  })
  return result.join("")
}
