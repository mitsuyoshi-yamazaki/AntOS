/**
# StampRoomPlans
## 概要
- 手動で定義されたRoomPlan

## 仕様

## Future Work
- それぞれのセルにメタ情報を付与したい
  - 削除可能（& どこで補完するか）
- RampartやContainerなど重複可能なStructureの情報
- 防御やEconomyの仕様
 */

type LayoutMarkBlank = "."
type LayoutMarkRoad = "-"
type LayoutMarkLink = "i"
type LayoutMarkLab = "l"
type LayoutMarkTower = "t"
type LayoutMarkSpawn = "s"
type LayoutMarkExtension = "x"
type LayoutMarkStorage = "1"
type LayoutMarkTerminal = "2"
type LayoutMarkNuker = "3"
type LayoutMarkObserver = "4"
type LayoutMarkPoserSpawn = "5"

const LayoutMarkBlank: LayoutMarkBlank = "."
const LayoutMarkRoad: LayoutMarkRoad = "-"
const LayoutMarkLink: LayoutMarkLink = "i"
const LayoutMarkLab: LayoutMarkLab = "l"
const LayoutMarkTower: LayoutMarkTower = "t"
const LayoutMarkSpawn: LayoutMarkSpawn = "s"
const LayoutMarkExtension: LayoutMarkExtension = "x"
const LayoutMarkStorage: LayoutMarkStorage = "1"
const LayoutMarkTerminal: LayoutMarkTerminal = "2"
const LayoutMarkNuker: LayoutMarkNuker = "3"
const LayoutMarkObserver: LayoutMarkObserver = "4"
const LayoutMarkPoserSpawn: LayoutMarkPoserSpawn = "5"

const layoutMarks = [
  LayoutMarkBlank,
  LayoutMarkRoad,
  LayoutMarkLink,
  LayoutMarkLab,
  LayoutMarkTower,
  LayoutMarkSpawn,
  LayoutMarkExtension,
  LayoutMarkStorage,
  LayoutMarkTerminal,
  LayoutMarkNuker,
  LayoutMarkObserver,
  LayoutMarkPoserSpawn,
] as const

export type LayoutMark = typeof layoutMarks[number]
export type StampRoomPlan = LayoutMark[][]


const halfSizeRoomPlan01: StampRoomPlan = [
  "t---t--t",
  "-4xx-xx-",
  "-xx-x-x-",
  "-x-sts-3",
  "t-xi-1--",
  "-x-s2-ll",
  "-xx--l-l",
  "t--5-ll-",
].map(line => line.split("") as LayoutMark[])


const stampRoomPlans = {
  halfSizeRoomPlan01,
}

const flagColors: Readonly<{ [L in LayoutMark]: [ColorConstant] | [ColorConstant, ColorConstant] | null }> = {
  ".": null,
  "-": [COLOR_BROWN],
  i: [COLOR_ORANGE],
  l: [COLOR_BLUE],
  t: [COLOR_RED],
  s: [COLOR_GREY],
  x: [COLOR_WHITE],
  "1": [COLOR_GREEN, COLOR_GREEN],
  "2": [COLOR_GREEN, COLOR_PURPLE],
  "3": [COLOR_GREEN, COLOR_RED],
  "4": [COLOR_GREEN, COLOR_BLUE],
  "5": [COLOR_GREEN, COLOR_GREY],
}

export const StampRoomPlan = {
  flagColors,

  getStampRoomPlanByName(name: string): StampRoomPlan | null {
    return (stampRoomPlans as { [K: string]: StampRoomPlan })[name] ?? null
  },

  getWebColor(color: ColorConstant): string {
    switch (color) {
    case COLOR_RED:
      return "red"
    case COLOR_PURPLE:
      return "purple"
    case COLOR_BLUE:
      return "blue"
    case COLOR_CYAN:
      return "cyan"
    case COLOR_GREEN:
      return "green"
    case COLOR_YELLOW:
      return "yellow"
    case COLOR_ORANGE:
      return "orange"
    case COLOR_BROWN:
      return "brown"
    case COLOR_GREY:
      return "grey"
    case COLOR_WHITE:
      return "white"
    }
  },
}
