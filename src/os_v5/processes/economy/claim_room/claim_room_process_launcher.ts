import { AnyProcess } from "os_v5/process/process"
import {} from "./claim_room_process"

export class ClaimRoomProcessLauncher {
  public constructor(
    public readonly targetRoomName: Room,
  ) { }

  // TODO: 不備があった際に呼び出し元に問い合わせられるようにする
  /** @throws */
  public launch(): AnyProcess {
    throw "not implemented yet"
  }
}
