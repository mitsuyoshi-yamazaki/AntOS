import { ScreepsOS } from "./screeps_os";

export const bootLoader = {
  load(): ScreepsOS {
    return new ScreepsOS()
  },
}
