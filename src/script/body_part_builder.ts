export function buildBodyParts(energyCapacity: number, bodyUnit: BodyPartConstant[], maxWeight: number, bodyUnitCost?: number): BodyPartConstant[] {
  const cost = bodyUnitCost ?? bodyUnit.reduce((result, current) => result + BODYPART_COST[current], 0)
  const body: BodyPartConstant[] = []
  for (let i = 1; i <= maxWeight; i += 1) {
    if (cost * i > energyCapacity) {
      break
    }
    body.push(...bodyUnit)
  }
  return body
}
