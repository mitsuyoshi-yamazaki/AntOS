export const MineralBaseCompoundsConstant: MineralBaseCompoundsConstant[] = [
  RESOURCE_HYDROXIDE,
  RESOURCE_ZYNTHIUM_KEANITE,
  RESOURCE_UTRIUM_LEMERGITE,
  RESOURCE_GHODIUM
]

export const MineralBoostConstant: MineralBoostConstant[] = [
  RESOURCE_UTRIUM_HYDRIDE,
  RESOURCE_UTRIUM_OXIDE,
  RESOURCE_KEANIUM_HYDRIDE,
  RESOURCE_KEANIUM_OXIDE,
  RESOURCE_LEMERGIUM_HYDRIDE,
  RESOURCE_LEMERGIUM_OXIDE,
  RESOURCE_ZYNTHIUM_HYDRIDE,
  RESOURCE_ZYNTHIUM_OXIDE,
  RESOURCE_GHODIUM_HYDRIDE,
  RESOURCE_GHODIUM_OXIDE,
  RESOURCE_UTRIUM_ACID,
  RESOURCE_UTRIUM_ALKALIDE,
  RESOURCE_KEANIUM_ACID,
  RESOURCE_KEANIUM_ALKALIDE,
  RESOURCE_LEMERGIUM_ACID,
  RESOURCE_LEMERGIUM_ALKALIDE,
  RESOURCE_ZYNTHIUM_ACID,
  RESOURCE_ZYNTHIUM_ALKALIDE,
  RESOURCE_GHODIUM_ACID,
  RESOURCE_GHODIUM_ALKALIDE,
  RESOURCE_CATALYZED_UTRIUM_ACID,
  RESOURCE_CATALYZED_UTRIUM_ALKALIDE,
  RESOURCE_CATALYZED_KEANIUM_ACID,
  RESOURCE_CATALYZED_KEANIUM_ALKALIDE,
  RESOURCE_CATALYZED_LEMERGIUM_ACID,
  RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE,
  RESOURCE_CATALYZED_ZYNTHIUM_ACID,
  RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE,
  RESOURCE_CATALYZED_GHODIUM_ACID,
  RESOURCE_CATALYZED_GHODIUM_ALKALIDE
]

export const MineralCompoundConstant: MineralCompoundConstant[] = [
  ...MineralBaseCompoundsConstant,
  ...MineralBoostConstant,
]

export const MineralConstant: MineralConstant[] = [
  RESOURCE_UTRIUM,
  RESOURCE_LEMERGIUM,
  RESOURCE_KEANIUM,
  RESOURCE_ZYNTHIUM,
  RESOURCE_OXYGEN,
  RESOURCE_HYDROGEN,
  RESOURCE_CATALYST
]

export const DepositConstant: DepositConstant[] = [
  RESOURCE_MIST,
  RESOURCE_BIOMASS,
  RESOURCE_METAL,
  RESOURCE_SILICON,
]

export const CommodityConstant: CommodityConstant[] = [
  RESOURCE_UTRIUM_BAR,
  RESOURCE_LEMERGIUM_BAR,
  RESOURCE_ZYNTHIUM_BAR,
  RESOURCE_KEANIUM_BAR,
  RESOURCE_GHODIUM_MELT,
  RESOURCE_OXIDANT,
  RESOURCE_REDUCTANT,
  RESOURCE_PURIFIER,
  RESOURCE_BATTERY,
  RESOURCE_COMPOSITE,
  RESOURCE_CRYSTAL,
  RESOURCE_LIQUID,
  RESOURCE_WIRE,
  RESOURCE_SWITCH,
  RESOURCE_TRANSISTOR,
  RESOURCE_MICROCHIP,
  RESOURCE_CIRCUIT,
  RESOURCE_DEVICE,
  RESOURCE_CELL,
  RESOURCE_PHLEGM,
  RESOURCE_TISSUE,
  RESOURCE_MUSCLE,
  RESOURCE_ORGANOID,
  RESOURCE_ORGANISM,
  RESOURCE_ALLOY,
  RESOURCE_TUBE,
  RESOURCE_FIXTURES,
  RESOURCE_FRAME,
  RESOURCE_HYDRAULICS,
  RESOURCE_MACHINE,
  RESOURCE_CONDENSATE,
  RESOURCE_CONCENTRATE,
  RESOURCE_EXTRACT,
  RESOURCE_SPIRIT,
  RESOURCE_EMANATION,
  RESOURCE_ESSENCE
]

export const ResourceConstant: ResourceConstant[] = [
  RESOURCE_ENERGY,
  RESOURCE_POWER,
  RESOURCE_OPS,
  ...MineralConstant,
  ...MineralCompoundConstant,
  ...DepositConstant,
  ...CommodityConstant,
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isMineralBoostConstant(arg: string): arg is MineralBoostConstant {
  return (MineralBoostConstant as string[]).includes(arg)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isMineralCompoundConstant(arg: string): arg is MineralCompoundConstant {
  return (MineralCompoundConstant as string[]).includes(arg)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isMineralConstant(arg: string): arg is MineralConstant {
  return (MineralConstant as string[]).includes(arg)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isDepositConstant(arg: string): arg is DepositConstant {
  return (DepositConstant as string[]).includes(arg)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isCommodityConstant(arg: string): arg is CommodityConstant {
  return (CommodityConstant as string[]).includes(arg)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isResourceConstant(arg: string): arg is ResourceConstant {
  return (ResourceConstant as string[]).includes(arg)
}

type IngredientType = MineralConstant | MineralCompoundConstant
export const MineralCompoundIngredients: { [index in MineralCompoundConstant]: { lhs: IngredientType, rhs: IngredientType } } = {
  OH: { lhs: RESOURCE_OXYGEN, rhs: RESOURCE_HYDROGEN },
  ZK: { lhs: RESOURCE_ZYNTHIUM, rhs: RESOURCE_KEANIUM },
  UL: { lhs: RESOURCE_UTRIUM, rhs: RESOURCE_LEMERGIUM },
  G: { lhs: RESOURCE_ZYNTHIUM_KEANITE, rhs: RESOURCE_UTRIUM_LEMERGITE },
  UH: { lhs: RESOURCE_UTRIUM, rhs: RESOURCE_HYDROGEN },
  UO: { lhs: RESOURCE_UTRIUM, rhs: RESOURCE_OXYGEN },
  KH: { lhs: RESOURCE_KEANIUM, rhs: RESOURCE_HYDROGEN },
  KO: { lhs: RESOURCE_KEANIUM, rhs: RESOURCE_OXYGEN },
  LH: { lhs: RESOURCE_LEMERGIUM, rhs: RESOURCE_HYDROGEN },
  LO: { lhs: RESOURCE_LEMERGIUM, rhs: RESOURCE_OXYGEN },
  ZH: { lhs: RESOURCE_ZYNTHIUM, rhs: RESOURCE_HYDROGEN },
  ZO: { lhs: RESOURCE_ZYNTHIUM, rhs: RESOURCE_OXYGEN },
  GH: { lhs: RESOURCE_GHODIUM, rhs: RESOURCE_HYDROGEN },
  GO: { lhs: RESOURCE_GHODIUM, rhs: RESOURCE_OXYGEN },
  UH2O: { lhs: RESOURCE_UTRIUM_HYDRIDE, rhs: RESOURCE_HYDROXIDE },
  UHO2: { lhs: RESOURCE_UTRIUM_OXIDE, rhs: RESOURCE_HYDROXIDE },
  KH2O: { lhs: RESOURCE_KEANIUM_HYDRIDE, rhs: RESOURCE_HYDROXIDE },
  KHO2: { lhs: RESOURCE_KEANIUM_OXIDE, rhs: RESOURCE_HYDROXIDE },
  LH2O: { lhs: RESOURCE_LEMERGIUM_HYDRIDE, rhs: RESOURCE_HYDROXIDE },
  LHO2: { lhs: RESOURCE_LEMERGIUM_OXIDE, rhs: RESOURCE_HYDROXIDE },
  ZH2O: { lhs: RESOURCE_ZYNTHIUM_HYDRIDE, rhs: RESOURCE_HYDROXIDE },
  ZHO2: { lhs: RESOURCE_ZYNTHIUM_OXIDE, rhs: RESOURCE_HYDROXIDE },
  GH2O: { lhs: RESOURCE_GHODIUM_HYDRIDE, rhs: RESOURCE_HYDROXIDE },
  GHO2: { lhs: RESOURCE_GHODIUM_OXIDE, rhs: RESOURCE_HYDROXIDE },
  XUH2O: { lhs: RESOURCE_UTRIUM_ACID, rhs: RESOURCE_CATALYST },
  XUHO2: { lhs: RESOURCE_UTRIUM_ALKALIDE, rhs: RESOURCE_CATALYST },
  XKH2O: { lhs: RESOURCE_KEANIUM_ACID, rhs: RESOURCE_CATALYST },
  XKHO2: { lhs: RESOURCE_KEANIUM_ALKALIDE, rhs: RESOURCE_CATALYST },
  XLH2O: { lhs: RESOURCE_LEMERGIUM_ACID, rhs: RESOURCE_CATALYST },
  XLHO2: { lhs: RESOURCE_LEMERGIUM_ALKALIDE, rhs: RESOURCE_CATALYST },
  XZH2O: { lhs: RESOURCE_ZYNTHIUM_ACID, rhs: RESOURCE_CATALYST },
  XZHO2: { lhs: RESOURCE_ZYNTHIUM_ALKALIDE, rhs: RESOURCE_CATALYST },
  XGH2O: { lhs: RESOURCE_GHODIUM_ACID, rhs: RESOURCE_CATALYST },
  XGHO2: { lhs: RESOURCE_GHODIUM_ALKALIDE, rhs: RESOURCE_CATALYST },
}
