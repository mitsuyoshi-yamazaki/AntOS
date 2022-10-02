import { SystemInfo } from "shared/utility/system_info"

const attackingSigns: string[] = [
  "🚫",
  "💥",
  "blockade",
].map(x => `${x} #overlords`)

const clearingZombie: string[] = [
  "clearing zombie"
]

const areaSigns: string[] = [
  "Restricted area",
  "Exclusion zone",
  "No entry",
].map(x => `${x} #overlords`)

export const Sign = {
  signFor(controller: StructureController): string {
    if (controller.my === true) {
      return this.signForOwnedRoom()
    }
    if (controller.owner != null) {
      return this.signForHostileRoom()
    }
    return areaSigns[Game.time % areaSigns.length] ?? ""
  },

  signForOwnedRoom(): string {
    return `${SystemInfo.application.name} v${SystemInfo.application.version}`
  },

  signForHostileRoom(): string {
    return attackingSigns[Game.time % attackingSigns.length] ?? ""
  },

  signForGclFarm(): string {
    return `GCL Farm v${SystemInfo.application.version} at ${Game.time}`
  },
}

/**
 * memo
 * - marked as zombie
 */
