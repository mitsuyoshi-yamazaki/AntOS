declare const COMMODITY_SCORE: { [commodityType: string]: number }

export function getSeason4CommodityScore(commodity: CommodityConstant): number {
  if (COMMODITY_SCORE == null) {
    return 0
  }
  return COMMODITY_SCORE[commodity] ?? 0
}

export function getSeason4ScoreableCommodities(): CommodityConstant[] {
  if (COMMODITY_SCORE == null) {
    return []
  }
  return Array.from(Object.keys(COMMODITY_SCORE)) as CommodityConstant[]
}
