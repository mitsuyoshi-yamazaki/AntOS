import { CreepRole } from "prototype/creep_role"

type CreepBodySpec = {
  roles: CreepRole[]
  body: BodyPartConstant[]
}

export const quadTypes = [
  "test-dismantler",
  "test-attacker",
  "invader-core-attacker",
  "tier0-d100-attacker",
  "tier0-d450",
  "tier0-d360-dismantler",
  "no-defence-3tower",
  "tier3-d2000-dismantler-swamp",
  "tier3-3tower-full-ranged-attacker",
] as const
export type QuadType = typeof quadTypes[number]

export const isQuadType = (obj: string): obj is QuadType => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return quadTypes.includes(obj as any)
}

export class QuadSpec {
  public readonly boosts: MineralBoostConstant[]

  public constructor(
    public readonly quadType: QuadType
  ) {
    this.boosts = this.getBoosts()
  }

  private getBoosts(): MineralBoostConstant[] {
    switch (this.quadType) {
    case "test-dismantler":
    case "test-attacker":
      return [...noBoosts]
    case "invader-core-attacker":
    case "tier0-d100-attacker":
    case "tier0-d450":
    case "tier0-d360-dismantler":
      return [...noBoosts]
    case "tier3-d2000-dismantler-swamp":
      return [...tier3DismantlerBoost1]
    case "no-defence-3tower":
      return [...noDefence3TowerAttackerBoost]
    case "tier3-3tower-full-ranged-attacker":
      return [...tier33TowerFullRangedAttackerBoosts]
    }
  }

  public creepCount(): number {
    switch (this.quadType) {
    case "test-dismantler":
    case "test-attacker":
      return 4
    case "invader-core-attacker":
      return 3
    case "tier0-d100-attacker":
    case "tier0-d450":
    case "tier0-d360-dismantler":
    case "tier3-d2000-dismantler-swamp":
    case "no-defence-3tower":
    case "tier3-3tower-full-ranged-attacker":
      return 4
    }
  }

  public creepSpecFor(creepInsufficiency: number): CreepBodySpec {
    switch (this.quadType) {
    case "test-dismantler":
      if (creepInsufficiency <= 1) {
        return testDismantlerSpec
      } else {
        return testHealerSpec
      }
    case "test-attacker":
      if (creepInsufficiency <= 1) {
        return testAttackerSpec
      } else {
        return testHealerSpec
      }
    case "invader-core-attacker":
      if (creepInsufficiency >= 2) {
        return invaderCoreAttackerAttacker
      } else {
        return invaderCoreAttackerHealer
      }
    case "tier0-d100-attacker":
      if (creepInsufficiency <= 1) {
        return tier0AttackerSpec
      } else {
        return tier0h3HealerSpec
      }
    case "tier0-d450":
      return tire0h10HealerSpec
    case "tier0-d360-dismantler":
      if (creepInsufficiency <= 1) {
        return tire0DismantlerSpec
      } else {
        return tire0h10HealerSpec
      }
    case "tier3-d2000-dismantler-swamp":
      if (creepInsufficiency <= 1) {
        return tier3SwampDismantlerSpec
      } else {
        return tier3SwampHealerSpec
      }
    case "no-defence-3tower":
      return noDefence3TowerAttackerSpec
    case "tier3-3tower-full-ranged-attacker":
      return tier33TowerFullRangedAttackerSpec
    }
  }
}

// ---- Specs ---- //
const noBoosts: MineralBoostConstant[] = [
]

const testHealerSpec: CreepBodySpec = {
  roles: [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover],
  body: [RANGED_ATTACK, MOVE, MOVE, HEAL],
}
const testDismantlerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Healer, CreepRole.Mover],
  body: [WORK, MOVE, MOVE, HEAL],
}
const testAttackerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Healer, CreepRole.Mover],
  body: [ATTACK, MOVE, MOVE, HEAL],
}

const invaderCoreAttackerAttacker: CreepBodySpec = {
  roles: [CreepRole.Attacker, CreepRole.Mover],
  body: [
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
  ],
}
const invaderCoreAttackerHealer: CreepBodySpec = {
  roles: [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover],
  body: [
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    HEAL, HEAL,
  ],
}

const tier0h3HealerSpec: CreepBodySpec = {
  roles: [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover],
  body: [
    RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
    MOVE, MOVE, MOVE,
    HEAL, HEAL, HEAL,
  ]
}
const tier0AttackerSpec: CreepBodySpec = {
  roles: [CreepRole.Attacker, CreepRole.Healer, CreepRole.Mover],
  body: [
    RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
    ATTACK, MOVE, ATTACK, MOVE, ATTACK, MOVE,
  ]
}

const tire0h10HealerSpec: CreepBodySpec = {
  roles: [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover],
  body: [
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
    RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, HEAL, HEAL, HEAL,
    MOVE, HEAL,
  ]
}
const tire0DismantlerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    WORK, WORK, WORK, WORK,
    WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
    WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
    WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
    WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
    WORK, MOVE,
    MOVE, MOVE, MOVE, MOVE,
  ]
}

// const noDefence3TowerAttackerSpec: CreepBodySpec = {
//   roles: [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover],
//   body: [
//     TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
//     TOUGH,
//     RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
//     RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
//     MOVE, MOVE, MOVE, MOVE, MOVE,
//     RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
//     RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
//     RANGED_ATTACK, RANGED_ATTACK,
//     MOVE, MOVE, MOVE, MOVE, MOVE,
//     MOVE, MOVE, MOVE, MOVE, MOVE,
//     MOVE, MOVE,
//     HEAL, HEAL, HEAL, HEAL, HEAL,
//   ]
// }
const noDefence3TowerAttackerSpec: CreepBodySpec = {  // for RCL7
  roles: [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
  ]
}


const noDefence3TowerAttackerBoost: MineralBoostConstant[] = [
  RESOURCE_ZYNTHIUM_OXIDE,
  RESOURCE_LEMERGIUM_ALKALIDE,
  RESOURCE_KEANIUM_ALKALIDE,
  RESOURCE_CATALYZED_GHODIUM_ALKALIDE,
]

const tier3SwampHealerSpec: CreepBodySpec = {
  roles: [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL,
  ]
}
const tier3SwampDismantlerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE,
  ]
}

// XZHO2,XLHO2,KHO2,XGHO2,XZH2O
const tier3DismantlerBoost1: MineralBoostConstant[] = [
  RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE,
  RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE,
  RESOURCE_KEANIUM_ALKALIDE,
  RESOURCE_CATALYZED_GHODIUM_ALKALIDE,
  RESOURCE_CATALYZED_ZYNTHIUM_ACID,
]

// ---- tier3-3tower-full-ranged-attacker ---- //
const tier33TowerFullRangedAttackerSpec: CreepBodySpec = {
  roles: [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    HEAL, HEAL, HEAL, HEAL,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
  ]
}

const tier33TowerFullRangedAttackerBoosts: MineralBoostConstant[] = [
  RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE,
  RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE,
  RESOURCE_KEANIUM_ALKALIDE,
  RESOURCE_CATALYZED_GHODIUM_ALKALIDE,
]
