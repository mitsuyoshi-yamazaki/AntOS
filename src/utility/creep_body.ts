export function bodyCost(body: BodyPartConstant[]): number {
  return body.reduce((result, current) => {
    return result + BODYPART_COST[current]
  }, 0)
}

export type CreepBodyFixedAmountActionType = "harvest" | "build" | "repair" | "dismantle" | "upgradeController" | "attack" | "rangedAttack" | "heal" | "capacity"
export type CreepBodyActionType = CreepBodyFixedAmountActionType | "rangedMassAttack" | "rangedHeal"
export type CreepBodyBoostableActionType = CreepBodyActionType | "fatigue" | "damage"
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

export function boostForBody(bodyPart: BodyPartDefinition, actionType: CreepBodyFixedAmountActionType): number {
  if (typeof bodyPart.boost !== "string") {
    return 1
  }
  const boostMap: { [index: string]: {[index: string]: number}} | undefined = BOOSTS[bodyPart.type]
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

export function bodyDescription(body: BodyPartConstant[]): string {
  const map = new Map<BodyPartConstant, number>()
  body.forEach(b => {
    map.set(b, (map.get(b) ?? 0) + 1)
  })
  const result: string[] = []
  map.forEach((value, key) => {
    result.push(`${value}${key}`)
  })
  return result.join("")
}
