import { strictEntries } from "shared/utility/strict_entries"
import { isIntersected } from "shared/utility/types"

const creepActions = [
  "move",
  "harvest",
  "attack",
  "build",
  "repair",
  "dismantle",
  "attackController",
  "rangedHeal",
  "heal",
  "rangedAttack",
  "rangedMassAttack",
  "upgradeController",
  "withdraw",
  "transfer",
  "drop",
  "pickup",
] as const

export type CreepActions = typeof creepActions[number]

export const exclusiveActions = {
  melee: new Set<CreepActions>(["harvest", "attack", "build", "repair", "dismantle", "attackController", "rangedHeal", "heal"]),
  ranged: new Set<CreepActions>(["rangedAttack", "rangedMassAttack", "build", "repair", "rangedHeal"]),
  energyTransfer: new Set<CreepActions>(["upgradeController", "build", "repair", "withdraw", "transfer", "drop"]),
  move: new Set<CreepActions>(["move"]),
} as const

const actionByExclusiveActions = {} as { [K in CreepActions]: Set<CreepActions> }

creepActions.forEach(action => {
  const exclusiveActionList = strictEntries(exclusiveActions).flatMap(([, actions]): CreepActions[] => {
    if (actions.has(action) !== true) {
      return []
    }
    return [...actions]
  })
  actionByExclusiveActions[action] = new Set<CreepActions>([...exclusiveActionList])
})

export const canExecuteAction = (action: CreepActions, executedActions: Set<CreepActions>): boolean => {
  if (executedActions.size <= 0) {
    return true
  }
  if (isIntersected(executedActions, actionByExclusiveActions[action]) === true) {
    return false
  }
  return true
}
