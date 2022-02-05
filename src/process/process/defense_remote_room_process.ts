import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { coloredCreepBody, coloredText, profileLink, roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"
import { World } from "world_info/world_info"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { generateCodename } from "utility/unique_id"
import { CreepRole } from "prototype/creep_role"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { OperatingSystem } from "os/os"
import { RoomResources } from "room_resource/room_resources"
import { NormalRoomResource } from "room_resource/room_resource/normal_room_resource"
import { CreepBody } from "utility/creep_body"
import { Invader } from "game/invader"

ProcessDecoder.register("DefenseRemoteRoomProcess", state => {
  return DefenseRemoteRoomProcess.decode(state as DefenseRemoteRoomProcessState)
})

type TargetInfo = {
  readonly roomName: RoomName
  readonly attacker: {
    playerNames: string[],
    onlyNpc: boolean,
  },
  readonly totalPower: {
    readonly attack: number
    readonly rangedAttack: number
    readonly heal: number
  }
  readonly boosted: boolean
  readonly hostileCreepCount: number
  readonly priority: number // 大きい方が優先
}

type RoomInfo = {
  readonly name: RoomName
}

interface DefenseRemoteRoomProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetRooms: RoomInfo[]
  readonly currentTarget: TargetInfo | null
}

// Game.io("launch ObserveRoomProcess room_name=W23S25 target_room_name=W23S27 duration=100")
// Game.io("launch DefenseRemoteRoomProcess room_name=W23S28 target_room_names=W23S27")
export class DefenseRemoteRoomProcess implements Process, Procedural {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly targetRooms: RoomInfo[],
    private currentTarget: TargetInfo | null
  ) {
    this.identifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): DefenseRemoteRoomProcessState {
    return {
      t: "DefenseRemoteRoomProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetRooms: this.targetRooms,
      currentTarget: this.currentTarget,
    }
  }

  public static decode(state: DefenseRemoteRoomProcessState): DefenseRemoteRoomProcess {
    return new DefenseRemoteRoomProcess(state.l, state.i, state.roomName, state.targetRooms, state.currentTarget)
  }

  public static create(processId: ProcessId, roomName: RoomName, targetRoomNames: RoomName[]): DefenseRemoteRoomProcess {
    const targetRooms = targetRoomNames.map((name: RoomName): RoomInfo => ({name}))
    return new DefenseRemoteRoomProcess(Game.time, processId, roomName, targetRooms, null)
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      roomLink(this.roomName)
    ]
    if (this.currentTarget != null) {
      descriptions.push(targetDescription(this.currentTarget))
    }
    return descriptions.join(", ")
  }

  public runOnTick(): void {
    if (this.currentTarget == null) {
      this.checkRemoteRooms()
      return
    }

    // TODO:
  }

  private checkRemoteRooms(): void {
    const targets = this.targetRooms.flatMap((roomInfo): TargetInfo[] => {
      const roomResource = RoomResources.getNormalRoomResource(roomInfo.name)
      if (roomResource == null) {
        // console.log(`no room resource for ${roomInfo.name}`)
        return []
      }
      if (roomResource.hostiles.creeps.length <= 0) {
        // console.log(`no hostile in ${roomInfo.name}`)
        return []
      }
      return [this.calculateTargetInfo(roomResource)]
    })

    // TODO:
    // targets.sort((lhs, rhs) => {
    //   if (lhs.attacker.onlyNpc !== rhs.attacker.onlyNpc) {
    //     return lhs.attacker.onlyNpc ? -1 : 1
    //   }
    // })

    const target = targets[0] ?? null
    this.currentTarget = target
  }

  private calculateTargetInfo(roomResource: NormalRoomResource): TargetInfo {
    const playerNames: string[] = []
    let totalAttackPower = 0
    let totalRangedAttackPower = 0
    let totalHealPower = 0
    let boosted = false as boolean

    roomResource.hostiles.creeps.forEach(creep => {
      if (playerNames.includes(creep.owner.username) !== true) {
        playerNames.push(creep.owner.username)
      }
      totalAttackPower += CreepBody.power(creep.body, "attack")
      totalRangedAttackPower += CreepBody.power(creep.body, "rangedAttack")
      totalHealPower += CreepBody.power(creep.body, "heal")
      if (boosted !== true && creep.body.some(body => body.boost != null)) {
        boosted = true
      }
    })

    const onlyNpc = playerNames.length === 1 && playerNames[0] === Invader.username
    const priority = ((): number => {
      let value = 0
      value += totalAttackPower * 0.3
      value += totalRangedAttackPower
      value += totalHealPower * 3
      return value
    })()

    return {
      roomName: roomResource.room.name,
      attacker: {
        playerNames,
        onlyNpc,
      },
      totalPower: {
        attack: totalAttackPower,
        rangedAttack: totalRangedAttackPower,
        heal: totalHealPower,
      },
      boosted,
      hostileCreepCount: roomResource.hostiles.creeps.length,
      priority,
    }
  }
}

function targetDescription(targetInfo: TargetInfo): string {
  const actionPowerDescription = (action: ATTACK | RANGED_ATTACK | HEAL): string => {
    switch (action) {
    case ATTACK:
      return `<b>${coloredText(`${targetInfo.totalPower.attack}`, "info")}</b>${coloredCreepBody(ATTACK)}`
    case RANGED_ATTACK:
      return `<b>${coloredText(`${targetInfo.totalPower.rangedAttack}`, "info")}</b>${coloredCreepBody(RANGED_ATTACK)}`
    case HEAL:
      return `<b>${coloredText(`${targetInfo.totalPower.heal}`, "info")}</b>${coloredCreepBody(HEAL)}`
    }
  }

  const descriptions: string[] = []
  if (targetInfo.boosted === true) {
    descriptions.push(coloredText("boosted", "error"))
  }
  const actionPowers: string[] = []
  if (targetInfo.totalPower.attack > 0) {
    actionPowers.push(actionPowerDescription(ATTACK))
  }
  if (targetInfo.totalPower.rangedAttack > 0) {
    actionPowers.push(actionPowerDescription(RANGED_ATTACK))
  }
  if (targetInfo.totalPower.heal > 0) {
    actionPowers.push(actionPowerDescription(HEAL))
  }
  if (actionPowers.length > 0) {
    descriptions.push(actionPowers.join(""))
  }
  const playerDescriptions = targetInfo.attacker.playerNames.map(name => profileLink(name)).join(",")
  descriptions.push(`${targetInfo.hostileCreepCount} ${playerDescriptions} creeps`)
  return descriptions.join(" ")
}
