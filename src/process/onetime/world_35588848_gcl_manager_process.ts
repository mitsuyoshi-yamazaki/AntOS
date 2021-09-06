import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName, roomTypeOf } from "utility/room_name"
import { coloredText, roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { generateCodename } from "utility/unique_id"
import { Timestamp } from "utility/timestamp"
import { RoomResources } from "room_resource/room_resources"
import { processLog } from "os/infrastructure/logger"
import { OperatingSystem } from "os/os"
import { BootstrapRoomManagerProcess } from "process/bootstrap_room_manager_process"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { CreepBody } from "utility/creep_body"
import { NormalRoomInfo } from "room_resource/room_info"

const firstSafemodeInterval = 20000
const maxClaimableRoomLinearDistance = 5  // 対角線は距離が倍長いため

type AttackRoomInfo = {
  readonly lastAttackTime: Timestamp,
}

export interface World35588848GclManagerProcessState extends ProcessState {
  readonly lastGcl: number
  readonly attackInfo: { [roomName: string]: AttackRoomInfo }
}

export class World35588848GclManagerProcess implements Process, Procedural {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private lastGcl: number,
    private readonly attackInfo: { [roomName: string]: AttackRoomInfo },
  ) {
    this.identifier = `${this.constructor.name}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): World35588848GclManagerProcessState {
    return {
      t: "World35588848GclManagerProcess",
      l: this.launchTime,
      i: this.processId,
      lastGcl: this.lastGcl,
      attackInfo: this.attackInfo,
    }
  }

  public static decode(state: World35588848GclManagerProcessState): World35588848GclManagerProcess {
    return new World35588848GclManagerProcess(state.l, state.i, state.lastGcl, state.attackInfo)
  }

  public static create(processId: ProcessId): World35588848GclManagerProcess {
    return new World35588848GclManagerProcess(Game.time, processId, 1, {})
  }

  public processShortDescription(): string {
    return `GCL: ${Game.gcl.level}`
  }

  public runOnTick(): void {
    if (Game.time <= firstSafemodeInterval) {
      return
    }

    const interval = 109
    if ((Game.time % interval) !== 17) {
      return
    }

    const gcl = Game.gcl.level
    this.lastGcl = gcl

    this.manageBootstrap()
    this.launchAttacker()
  }

  private manageBootstrap(): void {
    const gcl = Game.gcl.level
    const ownedRoomResources = RoomResources.getOwnedRoomResources()
    const claimableRoomCount = gcl - ownedRoomResources.length

    if (claimableRoomCount <= 0) {
      console.log("no claimableRoomCount")
      return
    }

    const bootstrapRoomManagerProcess = OperatingSystem.os.listAllProcesses()
      .find(processInfo => processInfo.process instanceof BootstrapRoomManagerProcess)?.process as BootstrapRoomManagerProcess ?? null
    if (bootstrapRoomManagerProcess == null) {
      console.log("no bootstrapRoomManagerProcess")
      return
    }
    // if ((claimableRoomCount - bootstrapRoomManagerProcess.claimingRoomCount()) <= 0) { // TODO: 現状ではオフ
    //   return
    // }
    if (bootstrapRoomManagerProcess.claimingRoomCount() > 0) {
      console.log("bootstrapping")
      return
    }

    this.claimNewRoom(ownedRoomResources, bootstrapRoomManagerProcess)
  }

  private claimNewRoom(ownedRoomResources: OwnedRoomResource[], bootstrapRoomManagerProcess: BootstrapRoomManagerProcess): void {
    const calculateScore = (roomInfo: NormalRoomInfo): number => {
      // 大きい方が良い
      const sourceScore = roomInfo.numberOfSources * 1000
      let remoteSourceScore = 0
      let neighbourScore = 0

      roomInfo.neighbourRoomNames.forEach(neighbourRoomName => {
        const neighbourRoomInfo = RoomResources.getRoomInfo(neighbourRoomName)
        if (neighbourRoomInfo == null) {
          return
        }
        if (neighbourRoomInfo.roomType !== "normal") {
          return
        }
        if (roomTypeOf(neighbourRoomName) === "normal") {
          remoteSourceScore += neighbourRoomInfo.numberOfSources * 400
          neighbourScore += 200
        }

        switch (neighbourRoomInfo.owner?.ownerType) {
        case "claim":
          neighbourScore -= 10000
          break
        case "reserve":
          neighbourScore -= 5000
          break
        default:
          break
        }
      })

      return sourceScore + remoteSourceScore + neighbourScore
    }

    const minimumClaimerBodyCost = CreepBody.cost([CLAIM, MOVE])
    const parentRoomResources = ownedRoomResources.filter(resources => {
      if (resources.room.energyCapacityAvailable < minimumClaimerBodyCost) {
        return false
      }
      const availableEnergy = (resources.activeStructures.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
        + (resources.activeStructures.terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
      if (availableEnergy < 5000) {
        return false
      }
      return true
    })

    if (parentRoomResources.length <= 0) {
      processLog(this, "no parent rooms")
      return
    }

    const claimableRoomInfo: { roomName: RoomName, roomInfo: NormalRoomInfo, score: number}[] = RoomResources.getAllRoomInfo()
      .flatMap(({roomName, roomInfo}) => {
        if (roomInfo.roomType !== "normal") {
          return []
        }
        if (roomInfo.owner != null) {
          return []
        }
        if (roomTypeOf(roomName) !== "normal") {
          return []
        }

        const isAvailable = ((): boolean => {
          let parentRoomInRange = false as boolean
          for (const resources of parentRoomResources) {
            if (parentRoomInRange !== true && Game.map.getRoomLinearDistance(roomName, resources.room.name) <= maxClaimableRoomLinearDistance) {
              parentRoomInRange = true
            }
            const nextToParent = roomInfo.neighbourRoomNames.some(neighbourRoomName => {
              const neighbourRoomInfo = RoomResources.getRoomInfo(neighbourRoomName)
              if (neighbourRoomInfo == null) {
                return false
              }
              if (neighbourRoomInfo.roomType !== "owned") {
                return false
              }
              return true
            })
            if (nextToParent === true) {
              return false
            }
          }
          return parentRoomInRange
        })()
        if (isAvailable !== true) {
          return []
        }

        const score = calculateScore(roomInfo)
        if (score <= 0) {
          return []
        }

        return {
          roomName,
          roomInfo,
          score,
        }
      })

    const roomToClaim = claimableRoomInfo.sort((lhs, rhs) => {
      return rhs.score - lhs.score
    })[0]

    if (roomToClaim == null) {
      processLog(this, `${coloredText("[Warning]", "warn")} no good rooms to claim`)
      return
    }

    const parentRoomInfo = parentRoomResources.sort((lhs, rhs) => {
      const lLevel = Math.min(lhs.controller.level, 6)
      const rLevel = Math.min(rhs.controller.level, 6)
      if (lLevel === rLevel) {
        return Game.map.getRoomLinearDistance(roomToClaim.roomName, lhs.room.name) - Game.map.getRoomLinearDistance(roomToClaim.roomName, rhs.room.name)
      }
      return rhs.controller.level - lhs.controller.level
    })[0]

    if (parentRoomInfo == null) {
      processLog(this, `${coloredText("[Warning]", "warn")} no parent rooms for claiming ${roomLink(roomToClaim.roomName)}`)
      return
    }

    bootstrapRoomManagerProcess.addBootstrapRoom(
      parentRoomInfo.room.name,
      roomToClaim.roomName,
      [],
      {
        parentRoomName: parentRoomInfo.room.name,
        waypoints: [],
      },
      Game.gcl.level,
    )
  }

  private launchAttacker(): void {

  }
}
