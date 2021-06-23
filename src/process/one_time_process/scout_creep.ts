import {
  ProcessId,
  Procedural,
  StatefulProcess,
} from "../process"
import { MessageObserver } from "../../os/infrastructure/console_command/message_command"

interface ScoutCreepProcessMemory {
  c: string   // creepId
  r: string   // routes (room_name1,room_name2,...)
}

// W54S8,W55S8,W55S9,W56S9,W56S8
export class ScoutCreepProcess implements StatefulProcess, Procedural, MessageObserver {
  public readonly shouldStore = true

  private routes: string[]

  public constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly creepId: string,
    routes: string[],
  ) {
    this.routes = routes
  }

  // ---- StatefulProcess ---- //
  public static parseState(rawState: unknown): {creepId: string, routes: string[]} | null {
    const state = rawState as ScoutCreepProcessMemory
    if (typeof state.c !== "string" || typeof state.r !== "string") {
      return null
    }
    return {
      creepId: state.c,
      routes: state.r.split(","),
    }
  }

  public encode(): ScoutCreepProcessMemory {
    return {
      c: this.creepId,
      r: this.routes.join(","),
    }
  }

  // ---- Procedural ---- //
  public runOnTick(): void {
    // console.log(`ScoutCreepProcess running with creep id: ${this.creepId} at ${Game.time}`)
    const creep = Game.getObjectById(this.creepId) as Creep
    if (!(creep instanceof Creep)) {
      console.log(`ScoutCreepProcess invalid creep ID ${this.creepId}`)
      return
    }

    if (this.routes.length === 0) {
      creep.say("done")
      return
    }
    const currentRoomName = creep.room.name
    if (this.routes[0] === currentRoomName) {
      this.routes.splice(0, 1)
      if (this.routes.length === 0) {
        creep.say("done")
        return
      }
    }
    if (creep.room.controller != null && creep.room.controller.sign?.username !== "Mitsuyoshi") {
      this.sign(creep, creep.room.controller)
    } else {
      creep.moveToRoom(this.routes[0])
      creep.say(`go to ${this.routes[0]}`)
    }
  }

  private sign(creep: Creep, controller: StructureController): void {
    const sign = () => {
      const emoji = ["😆", "😄", "😐", "😴", "🤔", "🙃", "😃", "😑", "😖", "😝"]
      const index = (Number(creep.room.name.slice(1, 3)) + Number(creep.room.name.slice(4, 6))) % emoji.length
      return emoji[index]
    }
    const result = creep.signController(controller, sign())
    if (result === ERR_NOT_IN_RANGE) {
      creep.say("🏃‍♂️")
      creep.moveTo(controller)
    } else if (result < 0) {
      console.log(`sign controller error: ${result}`)
    }
  }

  // ---- MessageObserver ---- //
  public didReceiveMessage(message: unknown): string {
    if (typeof (message) !== "string") {
      return `ScoutCreepProcess ${this.processId} received invalid message ${message}`
    }
    this.routes = message.split(",")
    return `ScoutCreepProcess ${this.processId} received message: ${message}`
  }
}
