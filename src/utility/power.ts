export const PowerConstant: PowerConstant[] = [
  PWR_GENERATE_OPS,
  PWR_OPERATE_SPAWN,
  PWR_OPERATE_TOWER,
  PWR_OPERATE_STORAGE,
  PWR_OPERATE_LAB,
  PWR_OPERATE_EXTENSION,
  PWR_OPERATE_OBSERVER,
  PWR_OPERATE_TERMINAL,
  PWR_DISRUPT_SPAWN,
  PWR_DISRUPT_TOWER,
  PWR_DISRUPT_SOURCE,
  PWR_SHIELD,
  PWR_REGEN_SOURCE,
  PWR_REGEN_MINERAL,
  PWR_DISRUPT_TERMINAL,
  PWR_OPERATE_POWER,
  PWR_FORTIFY,
  PWR_OPERATE_CONTROLLER,
  PWR_OPERATE_FACTORY,
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isPowerConstant(arg: number): arg is PowerConstant {
  return (PowerConstant as number[]).includes(arg)
}

export function powerName(powerType: PowerConstant): string {
  switch (powerType) {
  case PWR_GENERATE_OPS:
    return "PWR_GENERATE_OPS"
  case PWR_OPERATE_SPAWN:
    return "PWR_OPERATE_SPAWN"
  case PWR_OPERATE_TOWER:
    return "PWR_OPERATE_TOWER"
  case PWR_OPERATE_STORAGE:
    return "PWR_OPERATE_STORAGE"
  case PWR_OPERATE_LAB:
    return "PWR_OPERATE_LAB"
  case PWR_OPERATE_EXTENSION:
    return "PWR_OPERATE_EXTENSION"
  case PWR_OPERATE_OBSERVER:
    return "PWR_OPERATE_OBSERVER"
  case PWR_OPERATE_TERMINAL:
    return "PWR_OPERATE_TERMINAL"
  case PWR_DISRUPT_SPAWN:
    return "PWR_DISRUPT_SPAWN"
  case PWR_DISRUPT_TOWER:
    return "PWR_DISRUPT_TOWER"
  case PWR_DISRUPT_SOURCE:
    return "PWR_DISRUPT_SOURCE"
  case PWR_SHIELD:
    return "PWR_SHIELD"
  case PWR_REGEN_SOURCE:
    return "PWR_REGEN_SOURCE"
  case PWR_REGEN_MINERAL:
    return "PWR_REGEN_MINERAL"
  case PWR_DISRUPT_TERMINAL:
    return "PWR_DISRUPT_TERMINAL"
  case PWR_OPERATE_POWER:
    return "PWR_OPERATE_POWER"
  case PWR_FORTIFY:
    return "PWR_FORTIFY"
  case PWR_OPERATE_CONTROLLER:
    return "PWR_OPERATE_CONTROLLER"
  case PWR_OPERATE_FACTORY:
    return "PWR_OPERATE_FACTORY"
  }
}