import { Process, ProcessDependencies, ProcessId, processDefaultIdentifier, ProcessDefaultIdentifier } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { RoomName } from "shared/utility/room_name_types"
import { describePosition, Position } from "shared/utility/position_v2"
import { Timestamp } from "shared/utility/timestamp"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { Command, runCommands } from "os_v5/standard_io/command"
import { isMyRoom } from "shared/utility/room"
import { GameConstants } from "utility/constants"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { SystemCalls } from "os_v5/system_calls/interface"

type NukerInfo = {
  readonly nukerId: Id<StructureNuker>
  readonly position: Position
  launched: boolean
}

type NukeTarget = {
  readonly roomName: RoomName
  launchTime: Timestamp
  readonly interval: Timestamp
  readonly nukers: NukerInfo[]  // Nukerはcooldownの短い順にソートされる
}

type NukeProcessState = {
  readonly n: NukeTarget[]
}

const { roomLink, coloredResourceType, shortenedNumber, ordinalNumber } = ConsoleUtility

ProcessDecoder.register("NukeProcess", (processId: NukeProcessId, state: NukeProcessState) => NukeProcess.decode(processId, state))

export type NukeProcessId = ProcessId<void, ProcessDefaultIdentifier, void, NukeProcessState, NukeProcess>


export class NukeProcess extends Process<void, ProcessDefaultIdentifier, void, NukeProcessState, NukeProcess> {
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [],
  }

  private nextLaunch: Timestamp | null = null

  private constructor(
    public readonly processId: NukeProcessId,
    readonly targets: NukeTarget[]
  ) {
    super()

    this.updateNextLaunch()
  }

  public encode(): NukeProcessState {
    return {
      n: this.targets,
    }
  }

  public static decode(processId: NukeProcessId, state: NukeProcessState): NukeProcess {
    return new NukeProcess(processId, state.n)
  }

  public static create(processId: NukeProcessId): NukeProcess {
    return new NukeProcess(processId, [])
  }

  public getDependentData(): void { }

  public staticDescription(): string {
    const descriptions: string[] = [
      `${this.targets.length} targets`,
      this.targets.map(target => roomLink(target.roomName)).join(","),
    ]

    if (this.nextLaunch != null) {
      descriptions.unshift(`launch in ${this.nextLaunch - Game.time}`)
    }

    return descriptions.join(", ")
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  // Event Handler
  /** @throws */
  public didReceiveMessage(argumentParser: ArgumentParser): string {
    return runCommands(argumentParser, [
      this.statusCommand,
      this.showNukersCommand,
      this.addTargetCommand,
      this.checkAssignableNukersCommand,
    ])
  }

  public run(): void {
    if (this.nextLaunch == null) {
      return
    }
    if (this.nextLaunch < Game.time) {
      return
    }

    const logs: string[] = []
    const finishedIndices: number[] = []

    this.targets.forEach((target, index) => {
      if (target.launchTime > Game.time) {
        return
      }
      const launchResult = this.launch(target)
      logs.push(...launchResult.logs)

      if (launchResult.finished === true) {
        finishedIndices.unshift(index)
      }
    })

    finishedIndices.forEach(index => {
      this.targets.splice(index, 1)
    })

    if (logs.length > 0) {
      const concattedLogs = logs.map(x => `- ${x}`).join("\n")
      SystemCalls.logger.log(this, `Launch nukes:\n${concattedLogs}`, true)
    }

    this.updateNextLaunch()
  }


  // ---- Private ---- //
  private launch(target: NukeTarget): { logs: string[], finished: boolean } {
    const logs: string[] = []

    if (target.interval <= 0) {
      target.nukers.forEach(nukerInfo => {
        const nuker = Game.getObjectById(nukerInfo.nukerId)
        if (nuker == null) {
          logs.push(`Nuker ${nukerInfo.nukerId} was destroyed`)
          return
        }
        const position = new RoomPosition(nukerInfo.position.x, nukerInfo.position.y, target.roomName)
        const launchResult = nuker.launchNuke(position)

        switch (launchResult) {
        case OK:
          nukerInfo.launched = true
          break
        default:
          logs.push(`Nuke launch failed (${launchResult}) ${roomLink(nuker.room.name)} =&gt ${roomLink(target.roomName)}`)
          break
        }
      })

      return {
        logs,
        finished: true,
      }
    }

    const nukerInfo = ((): { nuker: StructureNuker, nukerInfo: NukerInfo } | null => {
      for (const nukerInfo of target.nukers) {
        if (nukerInfo.launched === true) {
          continue
        }
        const nuker = Game.getObjectById(nukerInfo.nukerId)
        if (nuker == null) {
          logs.push(`Nuker ${nukerInfo.nukerId} was destroyed`)
          continue
        }
        if (nuker.cooldown > 0) {
          logs.push(`Nuker at ${nuker.pos} is still cooling down (${nuker.cooldown})`)
          continue
        }
        return {
          nuker,
          nukerInfo,
        }
      }
      return null
    })()

    if (nukerInfo == null) {
      logs.push(`No nukers to launch to ${roomLink(target.roomName)}`)
      return {
        logs,
        finished: true,
      }
    }

    const position = new RoomPosition(nukerInfo.nukerInfo.position.x, nukerInfo.nukerInfo.position.y, target.roomName)
    const launchResult = nukerInfo.nuker.launchNuke(position)

    switch (launchResult) {
    case OK:
      nukerInfo.nukerInfo.launched = true
      break
    default:
      logs.push(`Nuke launch failed (${launchResult}) ${roomLink(nukerInfo.nuker.room.name)} =&gt ${roomLink(target.roomName)}`)
      break
    }

    const finished = target.nukers.every(x => x.launched)

    target.launchTime += target.interval

    return {
      logs,
      finished,
    }
  }

  private updateNextLaunch(): void {
    this.nextLaunch = null
    this.targets.forEach(target => {
      if (target.launchTime < Game.time) {
        return
      }
      if (this.nextLaunch == null) {
        this.nextLaunch = target.launchTime
        return
      }
      if (target.launchTime > this.nextLaunch) {
        return
      }
      this.nextLaunch = target.launchTime
    })
  }


  // ---- Command Runner ---- //
  private readonly statusCommand: Command = {
    command: "status",
    help: (): string => "stasut ",

    /** @throws */
    run: (): string => {
      const statuses: string[] = [
        `${this.targets.length} targets:`,
      ]

      this.targets.forEach(target => {
        statuses.push(`- ${roomLink(target.roomName)}: ${target.nukers.length} nukes in ${target.launchTime - Game.time} ticks, interval: ${target.interval}`)
        statuses.push(...target.nukers.map(nukerInfo => {
          const nuker = Game.getObjectById(nukerInfo.nukerId)
          if (nuker == null) {
            return `  - Nuker destroyed, launched: ${nukerInfo.launched}`
          }
          return `  - ${roomLink(nuker.room.name)}, launched: ${nukerInfo.launched}`
        }))
      })

      return statuses.join("\n")
    }
  }

  private readonly addTargetCommand: Command = {
    command: "add_target",
    help: (): string => "add_target {target room name} delay={int} interval={int}, room_names={nuker room names}",

    /** @throws */
    run: (argumentParser: ArgumentParser): string => {
      const targetRoomName = argumentParser.roomName([0, "target room name"]).parse()

      const targetRange = GameConstants.structure.nuke.targetRange
      const myRooms = Array.from(Object.values(Game.rooms))
        .filter(isMyRoom)
        .filter(room => Game.map.getRoomLinearDistance(targetRoomName, room.name) <= targetRange)

      if (myRooms.length <= 0) {
        throw `No owned rooms around ${roomLink(targetRoomName)}`
      }

      const reservedNukerIds = new Set(this.targets.flatMap((target): Id<StructureNuker>[] => {
        return target.nukers.map(nuker => nuker.nukerId)
      }))
      const nukerRooms = argumentParser.list("room_names", "my_room").parse()
      const nukers = nukerRooms.map(room => {
        const nuker = room.find<StructureNuker>(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_NUKER } })[0]
        if (nuker == null) {
          throw `No nuker in ${roomLink(room.name)}`
        }
        if (nuker.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          throw `Nuker in ${roomLink(room.name)} lack of energy`
        }
        if (nuker.store.getFreeCapacity(RESOURCE_GHODIUM) > 0) {
          throw `Nuker in ${roomLink(room.name)} lack of ghodium`
        }
        if (reservedNukerIds.has(nuker.id) === true) {
          throw `Nuker in ${roomLink(room.name)} already reserved`
        }
        return nuker
      })

      const targetFlags = Array.from(Object.values(Game.flags)).filter(flag => flag.pos.roomName === targetRoomName)
      if (nukers.length !== targetFlags.length) {
        throw `Target count mismatch: ${nukers.length} nukers != ${targetFlags.length} flags`
      }

      const delay = argumentParser.int("delay").parse({ min: 10 })
      const interval = argumentParser.int("interval").parse({ min: 0 })

      nukers.sort((lhs, rhs) => lhs.cooldown - rhs.cooldown)

      let launchTime = delay
      nukers.forEach((nuker, index) => {
        if (nuker.cooldown > launchTime) {
          throw `${ordinalNumber(index + 1)} nuker in ${roomLink(nuker.room.name)} will not be ready (cooldown ${nuker.cooldown} ticks, planned launch time: ${launchTime})`
        }
        launchTime += interval
      })

      const nukerInfo: NukerInfo[] = []
      nukers.forEach((nuker, index) => {
        const flag = targetFlags[index]
        if (flag == null) {
          throw `No ${ordinalNumber(index + 1)} flag`
        }

        nukerInfo.push({
          nukerId: nuker.id,
          position: { x: flag.pos.x, y: flag.pos.y } as Position,
          launched: false,
        })
      })

      this.targets.push({
        roomName: targetRoomName,
        launchTime: Game.time + delay,
        interval,
        nukers: nukerInfo,
      })

      this.updateNextLaunch()

      return `${roomLink(targetRoomName)} is added to target list`
    }
  }

  private readonly showNukersCommand: Command = {
    command: "show_nukers_in_range",
    help: (): string => "show_nukers_in_range {target room name}",

    /** @throws */
    run: (argumentParser: ArgumentParser): string => {
      const targetRoomName = argumentParser.roomName([0, "target room name"]).parse()

      const targetRange = GameConstants.structure.nuke.targetRange
      const myRooms = Array.from(Object.values(Game.rooms))
        .filter(isMyRoom)
        .filter(room => Game.map.getRoomLinearDistance(targetRoomName, room.name) <= targetRange)

      if (myRooms.length <= 0) {
        return `No owned rooms around ${roomLink(targetRoomName)}`
      }

      const reservedNukerIds = new Set(this.targets.flatMap((target): Id<StructureNuker>[] => {
        return target.nukers.map(nuker => nuker.nukerId)
      }))

      const roomInfo = myRooms.map((room): { order: number, description: string } => {
        if (room.controller.level < 8) {
          return {
            order: 10,
            description: `- ${roomLink(room.name)} RCL${room.controller.level}`,
          }
        }

        const nuker = room.find<StructureNuker>(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_NUKER } })[0]
        if (nuker == null) {
          return {
            order: 5,
            description: `- ${roomLink(room.name)} no nuker`,
          }
        }

        const prefix = reservedNukerIds.has(nuker.id) ? "- [reserved] " : "- "
        const { order, description } = nukerDescription(nuker)

        return {
          order,
          description: prefix + description,
        }
      })

      roomInfo.sort((lhs, rhs) => lhs.order - rhs.order)

      return `${roomInfo.length} rooms in range of ${roomLink(targetRoomName)}:\n${roomInfo.map(x => x.description).join("\n")}`
    }
  }

  private readonly checkAssignableNukersCommand: Command = {
    command: "check_assignable_nukers",
    help: (): string => "check_assignable_nukers {target room names} launch_in={time?} exclude_nuker_rooms={room names?}",

    /** @throws */
    run: (argumentParser: ArgumentParser): string => {
      // ターゲットの部屋にはFlagで目標を指定している必要がある

      const launchIn = argumentParser.int("launch_in").parseOptional({min: 0})
      const excludeNukerRooms = argumentParser.list("exclude_nuker_rooms", "room_name").parseOptional({my: true})

      const targetRoomNames = argumentParser.list([0, "target room name"], "room_name").parse()
      const allFlags = Array.from(Object.values(Game.flags))

      const targetRange = GameConstants.structure.nuke.targetRange
      const activeNukers = Array.from(Object.values(Game.rooms))
        .flatMap((room): StructureNuker[] => {
          if (room.controller?.my !== true) {
            return []
          }
          if (excludeNukerRooms != null && excludeNukerRooms.includes(room.name) === true) {
            return []
          }
          const nuker = room.find<StructureNuker>(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_NUKER } })[0]
          if (nuker == null || nuker.isActive() !== true) {
            return []
          }
          return [nuker]
        })


      const reservedNukerIds = new Set<Id<StructureNuker>>(this.targets.flatMap((target): Id<StructureNuker>[] => {
        return target.nukers.map(nuker => nuker.nukerId)
      }))

      const roomWithTargets = targetRoomNames.map((roomName): { roomName: RoomName, targetPositions: RoomPosition[], nukersInRange: StructureNuker[] } => ({
        roomName,
        targetPositions: allFlags.filter(flag => flag.pos.roomName === roomName).map(flag => flag.pos),
        nukersInRange: activeNukers
          .filter(nuker => Game.map.getRoomLinearDistance(nuker.room.name, roomName) <= targetRange && reservedNukerIds.has(nuker.id) !== true)
          .sort((lhs, rhs) => nukerDescription(lhs).order - nukerDescription(rhs).order),
      }))
      roomWithTargets.sort((lhs, rhs) => (lhs.nukersInRange.length - lhs.targetPositions.length) - (rhs.nukersInRange.length - rhs.targetPositions.length))


      const nukeTargetCount = roomWithTargets.reduce((sum, current) => sum + current.targetPositions.length, 0)
      const excludeRoomDescription = excludeNukerRooms != null ? ` excludes ${excludeNukerRooms.map(roomName => roomLink(roomName)).join(",")}` : ""
      const results: string[] = [
        `${roomWithTargets.length} target rooms with ${nukeTargetCount} nuke targets${excludeRoomDescription}`,
      ]


      let fullyAssigned = true
      const assignMap: { targetRoomName: RoomName, targets: { position: Position, nuker: StructureNuker }[] }[] = []
      let nextTargetRoom = roomWithTargets.shift()

      while (nextTargetRoom != null) {
        const targetRoom = nextTargetRoom
        const assignedTargets: { position: Position, nuker: StructureNuker }[] = []

        results.push(`- ${roomLink(targetRoom.roomName)}: ${targetRoom.targetPositions.length} targets`)

        targetRoom.targetPositions.forEach(targetPosition => {
          const assignedNuker = targetRoom.nukersInRange.shift()
          if (assignedNuker != null) {
            reservedNukerIds.add(assignedNuker.id)
            const {description} = nukerDescription(assignedNuker)
            results.push(`  - ${describePosition(targetPosition)}: ${description}`)

            assignedTargets.push({
              position: { x: targetPosition.x, y: targetPosition.y } as Position,
              nuker: assignedNuker,
            })

          } else {
            results.push(`  - ${describePosition(targetPosition)}: no available nukers`)
            fullyAssigned = false
          }

        })

        assignMap.push({
          targetRoomName: targetRoom.roomName,
          targets: assignedTargets,
        })

        roomWithTargets.forEach(t => {
          t.nukersInRange = t.nukersInRange.filter(nuker => reservedNukerIds.has(nuker.id) !== true)
        })

        roomWithTargets.sort((lhs, rhs) => (lhs.nukersInRange.length - lhs.targetPositions.length) - (rhs.nukersInRange.length - rhs.targetPositions.length))
        nextTargetRoom = roomWithTargets.shift()
      }

      if (launchIn != null) {
        if (fullyAssigned === true) {
          const launchTime = Game.time + launchIn

          assignMap.forEach(assign => {
            this.targets.push({
              roomName: assign.targetRoomName,
              launchTime,
              interval: 0,
              nukers: assign.targets.map((target): NukerInfo => {
                if (target.nuker.cooldown > launchIn) {
                  throw `Nuker in ${roomLink(target.nuker.room.name)} will not be ready (cooldown ${target.nuker.cooldown} ticks, planned launch time: ${launchIn})`
                }

                return {
                  nukerId: target.nuker.id,
                  position: target.position,
                  launched: false,
                }
              })
            })
          })
          this.updateNextLaunch()

          results.unshift(`Fully assigned ${assignMap.length} targets and will launch in ${launchIn}`)
        } else {
          results.unshift("Not fully assigned")
        }
      }

      return results.join("\n")
    }
  }
}

const resourceDescription = (resourceType: ResourceConstant, amount: number, capacity: number): string => {
  return `${coloredResourceType(resourceType)}: ${shortenedNumber(amount)}/${shortenedNumber(capacity)}`
}

const nukerDescription = (nuker: StructureNuker): {order: number, description: string} => {
  const energyAmount = nuker.store.getUsedCapacity(RESOURCE_ENERGY)
  const energyCapacity = nuker.store.getCapacity(RESOURCE_ENERGY)
  const ghodiumAmount = nuker.store.getUsedCapacity(RESOURCE_GHODIUM)
  const ghodiumCapacity = nuker.store.getCapacity(RESOURCE_GHODIUM)

  let order = 0
  const descriptions: string[] = [
    `${roomLink(nuker.room.name)}`,
  ]

  if (energyAmount < energyCapacity || ghodiumAmount < ghodiumCapacity) {
    order += 1
    descriptions.push(`${resourceDescription(RESOURCE_ENERGY, energyAmount, energyCapacity)}, ${resourceDescription(RESOURCE_GHODIUM, ghodiumAmount, ghodiumCapacity)}`)
  }

  if (nuker.cooldown > 0) {
    order += 1
    descriptions.push(`cooldown: ${nuker.cooldown}`)
  }

  return {
    order,
    description: descriptions.join(", "),
  }
}
