import { SystemInfo } from "shared/utility/system_info"
import { Environment } from "utility/environment"

const team = ((): string => {
  switch (Environment.world) {
  case "persistent world":
  case "private":
    return " #overlords"
  case "swc":
    return " #Beeeeees!"
  case "botarena":
  case "season 4":
  case "simulation":
  case "non game":
  case "unknown":
    return ""
  }
})()

const attackingSigns: string[] = [
  "🚫",
  "💥",
  "blockade",
].map(x => `${x}${team}`)

const clearingZombie: string[] = [
  "clearing zombie"
]

const areaSigns: string[] = [
  "Restricted area",
  "Exclusion zone",
  "No entry",
].map(x => `${x}${team}`)

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
    return `${SystemInfo.application.name} v${SystemInfo.application.version}${team}`
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
