import { DeclarationState } from "../declaration_state"

interface ObserveDeclarationState extends DeclarationState {
  readonly t: "ObserveDeclaration"
  readonly targetRoomName: RoomName
  readonly scoutProcessId: ProcessId
}

class ObserveDeclaration implements Declaration {
  public readonly identifier: DeclarationIdentifier
  public get progress(): DeclarationProgress {
    switch (this.finishCondition) {
      case "continuous":
        return {
          declarationProgress: "in progress",
          status: Game.rooms[this.targetRoomName] == null ? ""
      }
      case "one time":
        if (Game.rooms[this.targetRoomName] != null) {
          return "finished"
        }
        return "in progress"
    }
  }

  private constructor(
    public readonly launchTime: Timestamp,
    public readonly finishCondition: DeclarationFinishCondition,
    private readonly targetRoomName: RoomName,
    private readonly scoutProcessId: ProcessId,
  ) {
    this.identifier = `${this.constructor.name}_${this.finishCondition}_${this.targetRoomName}`
  }

  public encode(): ObserveDeclarationState {
    return {
      t: "ObserveDeclaration",
      launchTime: this.launchTime,
      finishCondition: this.finishCondition,
      targetRoomName: this.targetRoomName,
      scoutProcessId: this.scoutProcessId,
    }
  }

  public static decode(state: ObserveDeclarationState): ObserveDeclaration {
    return new ObserveDeclaration(state.launchTime, state.finishCondition, state.targetRoomName, state.scoutProcessId)
  }

  public static create(finishCondition: DeclarationFinishCondition, targetRoomName: RoomName): ObserveDeclaration {
    const parentRoomName = "" // TODO: 最も近いRoomを当てる
    const scoutProcess = OperatingSystem.os.addProcess(null, processId => ScoutRoomProcess.create(processId, parentRoomName, targetRoomName))
    return new ObserveDeclaration(Game.time, finishCondition, targetRoomName, scoutProcess.processId)
  }

  public runOnTick(): void {
  }
}

interface SignDeclarationState extends DeclarationState {
  readonly t: "SignDeclaration"
  readonly targetRoomName: RoomName
  readonly sign: string
}

class SignDeclaration implements Declaration, EventObserver {
  public readonly identifier: DeclarationIdentifier
  public get status(): DeclarationStatus {
    return "in progress"  // TODO:
  }

  private constructor(
    public readonly launchTime: Timestamp,
    public readonly finishCondition: DeclarationFinishCondition,
    private readonly targetRoomName: RoomName,
    private readonly sign: string,
  ) {
    this.identifier = `${this.constructor.name}_${this.finishCondition}_${this.targetRoomName}`
  }

  public encode(): SignDeclarationState {
    return {
      t: "SignDeclaration",
      launchTime: this.launchTime,
      finishCondition: this.finishCondition,
      targetRoomName: this.targetRoomName,
      sign: this.sign,
    }
  }

  public static decode(state: SignDeclarationState): SignDeclaration {
    return new SignDeclaration(state.launchTime, state.finishCondition, state.targetRoomName, state.sign)
  }

  public static create(finishCondition: DeclarationFinishCondition, targetRoomName: RoomName, sign: string): SignDeclaration {
    const targetRoom = Game.rooms[targetRoomName]
    // if (targetRoom != null) {

    // } else {
    //   // add ObserveDeclaration
    // }
    return new SignDeclaration(Game.time, finishCondition, targetRoomName, sign)
  }

  public didReceiveEvent(event: Event): void {

  }

  public runOnTick(): void {

  }
}
