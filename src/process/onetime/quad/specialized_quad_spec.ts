import { CreepRole } from "prototype/creep_role"
import { CreepBody } from "utility/creep_body"

type CreepBodySpec = {
  roles: CreepRole[]
  body: BodyPartConstant[]
}

export const quadTypes = [
  "test-dismantler",
  "test-attacker",
  "test-boosted-attacker",
  "scout",
  "invader-core-attacker",
  "rcl4-attacker",
  "tier0-d100-attacker",
  "tier0-2tower-drain-minimum",
  "tier0-d450",
  "tier0-d450-rcl7",
  "tier0-d360-dismantler",
  "tier0-d360-dismantler-rcl7",
  "tier0-d900",
  "tier0-swamp-attacker",
  "tier1-d750",
  "tier1-invader-core-lv1",
  "no-defence-3tower",
  "tier3-d2000-dismantler-swamp",
  "tier3-3tower-minimum-dismantler",
  "tier3-3tower-large-dismantler",
  "tier3-3tower-full-ranged-attacker",
  "tier3-4tower-dismantler",
  "tier3-4tower-dismantler-rcl7",
  "tier3-4tower-1dismantler",
  "tier3-4tower-1dismantler-rcl7",
  "tier3-4tower-rcl7",
  "tier3-3tower-dismantler-attacker",
  "tier3-2tower-attacker",
  "tier3-3tower-attacker",
  "tier3-3tower-dismantler",
  "tier3-4tower-2dismantler",
  "tier3-5tower-dismantler",
  "tier3-6tower-dismantler",
  "tier3-6tower-tank",
  "tier3-single-d750",
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
    case "scout":
      return [...noBoosts]
    case "test-boosted-attacker":
      return [...testAttackBoosts]
    case "invader-core-attacker":
    case "rcl4-attacker":
    case "tier0-2tower-drain-minimum":
    case "tier0-d100-attacker":
    case "tier0-d450":
    case "tier0-d450-rcl7":
    case "tier0-d360-dismantler":
    case "tier0-d360-dismantler-rcl7":
    case "tier0-d900":
    case "tier0-swamp-attacker":
      return [...noBoosts]
    case "tier1-d750":
      return [...tier1D750Boosts]
    case "tier1-invader-core-lv1":
      return [...tier1AttackerBoosts]
    case "tier3-d2000-dismantler-swamp":
      return [...tier3DismantlerBoost1]
    case "no-defence-3tower":
      return [...noDefence3TowerAttackerBoost]
    case "tier3-3tower-full-ranged-attacker":
      return [...tier33TowerFullRangedAttackerBoosts]
    case "tier3-4tower-dismantler":
    case "tier3-4tower-dismantler-rcl7":
    case "tier3-4tower-1dismantler":
    case "tier3-4tower-1dismantler-rcl7":
    case "tier3-4tower-rcl7":
    case "tier3-3tower-dismantler":
    case "tier3-3tower-minimum-dismantler":
    case "tier3-3tower-large-dismantler":
    case "tier3-4tower-2dismantler":
    case "tier3-5tower-dismantler":
    case "tier3-6tower-dismantler":
      return [...tier3DismantlerFullBoosts]
    case "tier3-3tower-dismantler-attacker":
      return [...tier3DismantlerAttackerFullBoosts]
    case "tier3-2tower-attacker":
    case "tier3-3tower-attacker":
      return [...tier3AttackerBoosts]
    case "tier3-6tower-tank":
      return [...tier3HealBoosts]
    case "tier3-single-d750":
      return [...tier3HealRangedAttackBoosts]
    }
  }

  public creepCount(): number {
    switch (this.quadType) {
    case "test-attacker":
      return 3
    case "test-dismantler":
    case "test-boosted-attacker":
      return 4
    case "tier3-3tower-minimum-dismantler":
    case "tier3-6tower-tank":
      return 3
    case "invader-core-attacker":
    case "tier1-invader-core-lv1":
      return 2
    case "scout":
    case "tier3-single-d750":
      return 1
    case "rcl4-attacker":
    case "tier0-2tower-drain-minimum":
    case "tier0-d100-attacker":
    case "tier0-d450":
    case "tier0-d450-rcl7":
    case "tier0-d360-dismantler":
    case "tier0-d360-dismantler-rcl7":
    case "tier0-d900":
    case "tier0-swamp-attacker":
    case "tier3-d2000-dismantler-swamp":
    case "tier1-d750":
    case "no-defence-3tower":
    case "tier3-3tower-full-ranged-attacker":
    case "tier3-3tower-large-dismantler":
    case "tier3-4tower-dismantler":
    case "tier3-4tower-dismantler-rcl7":
    case "tier3-4tower-1dismantler":
    case "tier3-4tower-1dismantler-rcl7":
    case "tier3-4tower-rcl7":
    case "tier3-3tower-dismantler-attacker":
    case "tier3-2tower-attacker":
    case "tier3-3tower-attacker":
    case "tier3-3tower-dismantler":
    case "tier3-4tower-2dismantler":
    case "tier3-5tower-dismantler":
    case "tier3-6tower-dismantler":
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
    case "test-boosted-attacker":
      if (creepInsufficiency <= 1) {
        return testAttackerSpec
      } else {
        return testHealerSpec
      }
    case "scout":
      return {
        roles: [CreepRole.Scout, CreepRole.Mover],
        body: [MOVE],
      }
    case "invader-core-attacker":
      if (creepInsufficiency >= 2) {
        return invaderCoreAttackerAttacker
      } else {
        return invaderCoreAttackerHealer
      }
    case "rcl4-attacker":
      if (creepInsufficiency <= 1) {
        return rcl4AttackerAttacker
      } else {
        return rcl4AttackerHealer
      }
    case "tier0-2tower-drain-minimum":
      return tier02TowerDrainMinimum
    case "tier0-d100-attacker":
      if (creepInsufficiency <= 1) {
        return tier0AttackerSpec
      } else {
        return tier0h3HealerSpec
      }
    case "tier0-d450":
      return tire0h10HealerSpec
    case "tier0-d450-rcl7":
      return tire0h10HealerRCL7Spec
    case "tier0-d900":
      return tire0h20HealerSpec
    case "tier0-swamp-attacker":
      if (creepInsufficiency <= 1) {
        return tier0SwampAttackerAttackerSpec
      } else {
        return tier0SwampAttackerHealerSpec
      }
    case "tier0-d360-dismantler":
      if (creepInsufficiency <= 1) {
        return tire0DismantlerSpec
      } else {
        return tire0h10HealerSpec
      }
    case "tier0-d360-dismantler-rcl7":
      if (creepInsufficiency <= 1) {
        return tire0DismantlerSpec
      } else {
        return tire0h10HealerRCL7Spec
      }
    case "tier1-d750":
      return tier1D750HealerSpec
    case "tier1-invader-core-lv1":
      if (creepInsufficiency <= 1) {
        return tier1InvaderCoreLv1HealerSpec
      } else {
        return tier1InvaderCoreLv1AttackerSpec
      }
    case "tier3-d2000-dismantler-swamp":
      if (creepInsufficiency <= 1) {
        return tier3SwampDismantlerSpec
      } else {
        return tier3SwampHealerSpec
      }
    case "no-defence-3tower":
      return noDefence3TowerAttackerSpec
    case "tier3-3tower-minimum-dismantler":
      if (creepInsufficiency <= 2) {
        return tier33TowerMinimumDismantlerHealerSpec
      } else {
        return tier33TowerMinimumDismantlerDismantlerSpec
      }
    case "tier3-3tower-large-dismantler":
      if ((creepInsufficiency % 2) === 0) {
        return tier33TowerLargeDismantlerDismantlerSpec
      } else {
        return tier33TowerMinimumDismantlerHealerSpec
      }
    case "tier3-3tower-full-ranged-attacker":
      return tier33TowerFullRangedAttackerSpec
    case "tier3-4tower-dismantler":
      if (creepInsufficiency <= 2) {
        return tier34TowerDismantlerHealerSpec
      } else {
        return tier34TowerDismantlerDismantlerSpec
      }
    case "tier3-4tower-dismantler-rcl7":
      if (creepInsufficiency <= 2) {
        return tier34TowerRCL7DismantlerHealerSpec
      } else {
        return tier34TowerDismantlerDismantlerSpec
      }
    case "tier3-4tower-1dismantler":
      if (creepInsufficiency <= 3) {
        return tier34Tower1DismantlerHealerSpec
      } else {
        return tier34Tower1DismantlerDismantlerSpec
      }
    case "tier3-4tower-1dismantler-rcl7":
      if (creepInsufficiency <= 3) {
        return tier34Tower1DismantlerRCL7HealerSpec
      } else {
        return tier34Tower1DismantlerDismantlerSpec
      }
    case "tier3-4tower-rcl7":
      return tier34TowerRCL7HealerSpec
    case "tier3-3tower-dismantler-attacker":
      if (creepInsufficiency <= 2) {
        return tier33TowerDismantlerAttackerHealerSpec
      } else if (creepInsufficiency === 3) {
        return tier33TowerDismantlerAttackerAttackerSpec
      } else {
        return tier33TowerDismantlerAttackerDismantlerSpec
      }
    case "tier3-2tower-attacker":
      if ((creepInsufficiency % 2) === 0) {
        return tier32TowerAttackerAttackerSpec
      } else {
        return tier32TowerAttackerHealerSpec
      }
    case "tier3-3tower-attacker":
      if ((creepInsufficiency % 2) === 0) {
        return tier33TowerAttackerAttackerSpec
      } else {
        return tier33TowerAttackerHealerSpec
      }
    case "tier3-3tower-dismantler":
      if (creepInsufficiency <= 2) {
        return tier33Tower2DismantlerHealerSpec
      } else {
        return tier33Tower2DismantlerDismantlerSpec
      }
    case "tier3-6tower-dismantler":
      if (creepInsufficiency <= 3) {
        return tier36TowerDismantlerHealerSpec
      } else {
        return tier36TowerDismantlerDismantlerSpec
      }
    case "tier3-4tower-2dismantler":
      if (creepInsufficiency <= 2) {
        return tier34Tower2DismantlerHealerSpec
      } else {
        return tier34Tower2DismantlerDismantlerSpec
      }
    case "tier3-5tower-dismantler":
      if (creepInsufficiency <= 3) {
        return tier35TowerDismantlerHealerSpec
      } else {
        return tier35TowerDismantlerDismantlerSpec
      }
    case "tier3-6tower-tank":
      return tier36TowerTankHealerSpec
    case "tier3-single-d750":
      return tier3SingleD750Spec
    }
  }

  public canHandleMelee(): boolean {
    switch (this.quadType) {
    case "test-dismantler":
    case "test-attacker":
    case "test-boosted-attacker":
    case "scout":
    case "invader-core-attacker":
    case "tier0-2tower-drain-minimum":
    case "tier0-d100-attacker":
    case "tier0-d450":
    case "tier0-d450-rcl7":
    case "tier0-d360-dismantler":
    case "tier0-d360-dismantler-rcl7":
    case "tier0-swamp-attacker":
    case "tier3-d2000-dismantler-swamp":
    case "tier1-d750":
    case "no-defence-3tower":
    case "tier3-3tower-minimum-dismantler":
    case "tier3-3tower-large-dismantler":
    case "tier3-3tower-full-ranged-attacker":
    case "tier3-4tower-dismantler":
    case "tier3-4tower-dismantler-rcl7":
    case "tier3-4tower-1dismantler":
    case "tier3-4tower-1dismantler-rcl7":
    case "tier3-4tower-rcl7":
    case "tier3-3tower-dismantler-attacker":
    case "tier3-3tower-dismantler":
    case "tier3-4tower-2dismantler":
    case "tier3-5tower-dismantler":
    case "tier3-6tower-dismantler":
    case "tier0-d900":
    case "tier3-6tower-tank":
    case "tier3-single-d750":
      return false
    case "rcl4-attacker":
    case "tier3-2tower-attacker":
    case "tier3-3tower-attacker":
    case "tier1-invader-core-lv1":
      return true
    }
  }

  public totalBoostAmounts(): Map<MineralBoostConstant, number> {
    const requiredBoosts = new Map<MineralBoostConstant, number>()
    const boosts = this.boosts
    if (boosts.length <= 0) {
      return requiredBoosts
    }

    const creepCount = this.creepCount()
    for (let i = creepCount; i > 0; i -= 1) {
      const body = this.creepSpecFor(i).body
      const boostCost = CreepBody.boostCost(body, boosts)
      boostCost.forEach((cost, boost) => {
        requiredBoosts.set(boost, (requiredBoosts.get(boost) ?? 0) + cost)
      })
    }
    return requiredBoosts
  }
}

// ---- Specs ---- //
const noBoosts: MineralBoostConstant[] = [
]

// ---- Test ---- //
const testHealerSpec: CreepBodySpec = {
  roles: [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover],
  body: [RANGED_ATTACK, MOVE, MOVE, HEAL],
}
const testDismantlerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Healer, CreepRole.Mover],
  body: [TOUGH, MOVE, WORK, MOVE],
}
const testAttackerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Healer, CreepRole.Mover],
  body: [TOUGH, MOVE, ATTACK, MOVE],
}

const testAttackBoosts: MineralBoostConstant[] = [
  RESOURCE_UTRIUM_HYDRIDE,
]

// ---- ---- //
const invaderCoreAttackerAttacker: CreepBodySpec = {
  roles: [CreepRole.Attacker, CreepRole.Mover],
  body: [
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
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

// ---- rcl4-attacker ---- //
const rcl4AttackerHealer: CreepBodySpec = {
  roles: [CreepRole.Healer, CreepRole.Mover],
  body: [
    HEAL, HEAL, HEAL,
    MOVE, MOVE, MOVE, MOVE,
    HEAL,
  ],
}
const rcl4AttackerAttacker: CreepBodySpec = {
  roles: [CreepRole.Attacker, CreepRole.Mover],
  body: [
    ATTACK, ATTACK, MOVE, MOVE,
    ATTACK, ATTACK, MOVE, MOVE,
    ATTACK, ATTACK, MOVE, MOVE,
    ATTACK, ATTACK, MOVE, MOVE,
    ATTACK, ATTACK, MOVE, MOVE,
  ],
}

// ---- tier0-2tower-drain-minimum ---- //
const tier02TowerDrainMinimum: CreepBodySpec = {
  roles: [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH,
    RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, HEAL,
  ],
}

// ---- ---- //
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
const tire0h10HealerRCL7Spec: CreepBodySpec = {
  roles: [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover],
  body: [
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
    RANGED_ATTACK, MOVE,
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
    WORK, WORK, WORK, WORK, WORK,
    WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
    WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
    WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
    WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
  ]
}

// ---- tier0-d900 ---- //
const tire0h20HealerSpec: CreepBodySpec = {
  roles: [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover],
  body: [
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, MOVE, HEAL, MOVE, HEAL, MOVE, HEAL, MOVE, HEAL, MOVE,
    HEAL, MOVE, HEAL, MOVE, HEAL, MOVE, HEAL, MOVE, HEAL, MOVE,
    HEAL, MOVE, HEAL, MOVE, HEAL, MOVE, HEAL, MOVE, HEAL, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
  ]
}

// ---- tier0-swamp-attacker ---- //
const tier0SwampAttackerAttackerSpec: CreepBodySpec = {
  roles: [CreepRole.Attacker, CreepRole.Mover],
  body: [
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK, MOVE,
    ATTACK, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK, MOVE,
    ATTACK, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK, MOVE,
    ATTACK, MOVE, ATTACK, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE,
  ]
}
const tier0SwampAttackerHealerSpec: CreepBodySpec = {
  roles: [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover],
  body: [
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
    RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, HEAL, HEAL,
  ]
}

// ---- tier1-d750 ---- //
const tier1D750HealerSpec: CreepBodySpec = {
  roles: [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover],
  body: [
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, HEAL, HEAL,
  ]
}

const tier1D750Boosts: MineralBoostConstant[] = [
  RESOURCE_ZYNTHIUM_OXIDE,
  RESOURCE_LEMERGIUM_OXIDE,
  RESOURCE_CATALYZED_KEANIUM_ALKALIDE,
]

// ---- tier1-invader-core-lv1 ---- //
const tier1InvaderCoreLv1AttackerSpec: CreepBodySpec = {
  roles: [CreepRole.Attacker, CreepRole.Mover],
  body: [
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE,
  ]
}
const tier1InvaderCoreLv1HealerSpec: CreepBodySpec = {
  roles: [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover],
  body: [
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL,
  ]
}

// ---- tier1 attacker boosts ---- //
const tier1AttackerBoosts: MineralBoostConstant[] = [
  RESOURCE_ZYNTHIUM_OXIDE,
  RESOURCE_UTRIUM_HYDRIDE,
  RESOURCE_LEMERGIUM_OXIDE,
  RESOURCE_KEANIUM_OXIDE,
]

// ---- no-defence-3tower ---- //
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

// ---- ---- //
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

// ---- tier3-3tower-minimum-dismantler ---- //
const tier33TowerMinimumDismantlerDismantlerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE,
  ]
}
const tier33TowerMinimumDismantlerHealerSpec: CreepBodySpec = {
  roles: [CreepRole.RangedAttacker, CreepRole.Healer, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL,
  ]
}

// ---- tier3-3tower-large-dismantler ---- //
const tier33TowerLargeDismantlerDismantlerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
  ]
}

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
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL,
  ]
}

const tier33TowerFullRangedAttackerBoosts: MineralBoostConstant[] = [
  RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE,
  RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE,
  RESOURCE_CATALYZED_KEANIUM_ALKALIDE,
  RESOURCE_CATALYZED_GHODIUM_ALKALIDE,
]


// ---- tier3-4tower-dismantler ---- //
const tier34TowerDismantlerDismantlerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
  ]
}
const tier34TowerDismantlerHealerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, HEAL, HEAL,
  ]
}
const tier34TowerRCL7DismantlerHealerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, HEAL, HEAL,
  ]
}
const tier3DismantlerFullBoosts: MineralBoostConstant[] = [
  RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE,
  RESOURCE_CATALYZED_ZYNTHIUM_ACID,
  RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE,
  RESOURCE_CATALYZED_KEANIUM_ALKALIDE,
  RESOURCE_CATALYZED_GHODIUM_ALKALIDE,
]

// ---- tier3-4tower-1dismantler ---- //
const tier34Tower1DismantlerDismantlerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
  ]
}
const tier34Tower1DismantlerHealerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
  ]
}
const tier34Tower1DismantlerRCL7HealerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
  ]
}

// ---- tier3-4tower-rcl7 ---- //
const tier34TowerRCL7HealerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL,
  ]
}

// ---- tier3-3tower-dismantler-attacker ---- //
const tier33TowerDismantlerAttackerDismantlerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
  ]
}
const tier33TowerDismantlerAttackerAttackerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
  ]
}
const tier33TowerDismantlerAttackerHealerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, HEAL, HEAL, HEAL,
  ]
}

// ---- ---- //
const tier3DismantlerAttackerFullBoosts: MineralBoostConstant[] = [
  RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE,
  RESOURCE_CATALYZED_UTRIUM_ACID,
  RESOURCE_CATALYZED_ZYNTHIUM_ACID,
  RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE,
  RESOURCE_CATALYZED_KEANIUM_ALKALIDE,
  RESOURCE_CATALYZED_GHODIUM_ALKALIDE,
]

// ---- tier3-2tower-attacker ---- //
const tier32TowerAttackerAttackerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK,
    TOUGH, TOUGH,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
  ]
}
const tier32TowerAttackerHealerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
  ]
}

// ---- ---- //
const tier3AttackerBoosts: MineralBoostConstant[] = [
  RESOURCE_CATALYZED_UTRIUM_ACID,
  RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE,
  RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE,
  RESOURCE_CATALYZED_KEANIUM_ALKALIDE,
  RESOURCE_CATALYZED_GHODIUM_ALKALIDE,
]

// ---- tier3-3tower-attacker ---- //
const tier33TowerAttackerAttackerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH,TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
    ATTACK, ATTACK, ATTACK, ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
  ]
}
const tier33TowerAttackerHealerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, HEAL,
  ]
}

// ---- tier3-3tower-dismantler ---- //
const tier33Tower2DismantlerDismantlerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
  ]
}
const tier33Tower2DismantlerHealerSpec = { ...tier33TowerAttackerHealerSpec}

// ---- tier3-4tower-2dismantler ---- //
const tier34Tower2DismantlerDismantlerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
  ]
}
const tier34Tower2DismantlerHealerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, HEAL, HEAL,
  ]
}

// ---- tier3-5tower-dismantler ---- //
const tier35TowerDismantlerDismantlerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
  ]
}
const tier35TowerDismantlerHealerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, HEAL,
  ]
}

// ---- tier3-6tower-dismantler ---- //
const tier36TowerDismantlerDismantlerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
  ]
}
const tier36TowerDismantlerHealerSpec: CreepBodySpec = {
  roles: [CreepRole.Worker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    TOUGH, TOUGH,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, HEAL, HEAL,
  ]
}

// ---- tier3-6tower-tank ---- //
const tier36TowerTankHealerSpec: CreepBodySpec = {
  roles: [CreepRole.Healer, CreepRole.RangedAttacker, CreepRole.Mover],
  body: [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, HEAL,
  ]
}

const tier3HealBoosts: MineralBoostConstant[] = [
  RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE,
]

// ---- tier3-single-d750 ---- //
const tier3SingleD750Spec: CreepBodySpec = {
  roles: [CreepRole.Healer, CreepRole.RangedAttacker, CreepRole.Mover],
  body: [
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL, HEAL, HEAL, HEAL, HEAL,
    HEAL,
  ]
}

const tier3HealRangedAttackBoosts: MineralBoostConstant[] = [
  RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE,
  RESOURCE_CATALYZED_KEANIUM_ALKALIDE,
]
