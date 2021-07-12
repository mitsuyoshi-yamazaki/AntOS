export function bodyCost(body: BodyPartConstant[]): number {
  return body.reduce((result, current) => {
    return result + BODYPART_COST[current]
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
