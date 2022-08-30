import { CreepBodyBoostableActionType, CreepBodyEnergyConsumeActionType, CreepBodyFixedAmountActionType, GameConstants } from "./constants"
import { anyColoredText, creepBodyColorCode } from "./log"
import { boostableCreepBody } from "../shared/utility/resource"

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

export function isBodyPartConstant(arg: string): arg is BodyPartConstant {
  return (BODYPARTS_ALL as string[]).includes(arg)
}

export const CreepBody = {
  create: function(baseBody: BodyPartConstant[], bodyUnit: BodyPartConstant[], energyCapacity: number, maxUnitCount: number): BodyPartConstant[] {
    return createCreepBody(baseBody, bodyUnit, energyCapacity, maxUnitCount)
  },

  cost: function(body: BodyPartConstant[]): number {
    return bodyCost(body)
  },

  boostCost: function (body: BodyPartConstant[], boosts: MineralBoostConstant[]): Map<MineralBoostConstant, number> {
    const result = new Map<MineralBoostConstant, number>()
    const boostMineralCost = GameConstants.creep.boostCost
    boosts.forEach(boost => {
      body.forEach(bodyPart => {
        if (boostableCreepBody(boost) !== bodyPart) {
          return
        }
        result.set(boost, (result.get(boost) ?? 0) + boostMineralCost)
      })
    })
    return result
  },

  spawnTime: function(body: BodyPartConstant[]): number {
    return body.length * GameConstants.creep.life.spawnTime
  },

  /** hitsは考慮されている */
  power: function (body: BodyPartDefinition[], actionType: CreepBodyFixedAmountActionType, options?: { ignoreHits?: boolean }):number {
    return bodyPower(body, actionType, options)
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

  boostFor(action: CreepBodyBoostableActionType, boostTier: 0 | 1 | 2 | 3): MineralBoostConstant | null {
    if (boostTier === 0) {
      return null
    }

    return boostForAction[action][boostTier]
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
export function bodyPower(body: BodyPartDefinition[], actionType: CreepBodyFixedAmountActionType, options?: {ignoreHits?: boolean}): number {
  const bodyPart = CreepActionToBodyPart[actionType]
  const actionPower = CreepBodyActionPower[actionType]  // FixMe: Mineral harvestでは値が異なる

  return body.reduce((result, current) => {
    if (current.type !== bodyPart) {
      return result
    }
    if (options?.ignoreHits !== true && current.hits <= 0) {
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

  const maxCountBasedOnEnergy = Math.floor((energyCapacity - baseCost) / unitCost)
  const maxCountBasedOnBody = Math.floor((GameConstants.creep.body.bodyPartMaxCount - baseBody.length) / bodyUnit.length)
  const maxCount = Math.min(maxCountBasedOnEnergy, maxCountBasedOnBody, maxUnitCount)

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

function coloredBodyShortDescription(body: BodyPartConstant): string {
  return anyColoredText(bodyShortDescription[body], creepBodyColorCode(body))
}

/** @deprecated use CreepBody.description() */
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

const boostForAction = {
  harvest: {
    1: RESOURCE_UTRIUM_OXIDE,
    2: RESOURCE_UTRIUM_ALKALIDE,
    3: RESOURCE_CATALYZED_UTRIUM_ALKALIDE,
  },
  build: {
    1: RESOURCE_LEMERGIUM_HYDRIDE,
    2: RESOURCE_LEMERGIUM_ACID,
    3: RESOURCE_CATALYZED_LEMERGIUM_ACID,
  },
  repair: {
    1: RESOURCE_LEMERGIUM_HYDRIDE,
    2: RESOURCE_LEMERGIUM_ACID,
    3: RESOURCE_CATALYZED_LEMERGIUM_ACID,
  },
  dismantle: {
    1: RESOURCE_ZYNTHIUM_HYDRIDE,
    2: RESOURCE_ZYNTHIUM_ACID,
    3: RESOURCE_CATALYZED_ZYNTHIUM_ACID,
  },
  upgradeController: {
    1: RESOURCE_GHODIUM_HYDRIDE,
    2: RESOURCE_GHODIUM_ACID,
    3: RESOURCE_CATALYZED_GHODIUM_ACID,
  },
  attack: {
    1: RESOURCE_UTRIUM_HYDRIDE,
    2: RESOURCE_UTRIUM_ACID,
    3: RESOURCE_CATALYZED_UTRIUM_ACID,
  },
  rangedAttack: {
    1: RESOURCE_KEANIUM_OXIDE,
    2: RESOURCE_KEANIUM_ALKALIDE,
    3: RESOURCE_CATALYZED_KEANIUM_ALKALIDE,
  },
  rangedMassAttack: {
    1: RESOURCE_KEANIUM_OXIDE,
    2: RESOURCE_KEANIUM_ALKALIDE,
    3: RESOURCE_CATALYZED_KEANIUM_ALKALIDE,
  },
  heal: {
    1: RESOURCE_LEMERGIUM_OXIDE,
    2: RESOURCE_LEMERGIUM_ALKALIDE,
    3: RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE,
  },
  rangedHeal: {
    1: RESOURCE_LEMERGIUM_OXIDE,
    2: RESOURCE_LEMERGIUM_ALKALIDE,
    3: RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE,
  },
  capacity: {
    1: RESOURCE_KEANIUM_HYDRIDE,
    2: RESOURCE_KEANIUM_ACID,
    3: RESOURCE_CATALYZED_KEANIUM_ACID,
  },
  fatigue: {
    1: RESOURCE_ZYNTHIUM_OXIDE,
    2: RESOURCE_ZYNTHIUM_ALKALIDE,
    3: RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE,
  },
  damage: {
    1: RESOURCE_GHODIUM_OXIDE,
    2: RESOURCE_GHODIUM_ALKALIDE,
    3: RESOURCE_CATALYZED_GHODIUM_ALKALIDE,
  },
}
