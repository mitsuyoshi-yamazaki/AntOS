/**
 # UniqueId
 ゲーム世界で一意でなければならないため旧実装を引き継いでいる
 */

import { UniqueId as OldImplementation } from "utility/unique_id"
import { SystemCall } from "../system_call"

interface UniqueIdInterface extends SystemCall {
  generate(prefix?: string): string
  generateFromInteger(index: number): string
}

export const UniqueId: UniqueIdInterface = {
  // 旧実装で行っている
  // load(): void {
  // },
  // startOfTick(): void {
  // },
  // endOfTick(): void {
  // },

  generate(prefix?: string): string {
    return OldImplementation.generate(prefix)
  },

  generateFromInteger(index: number): string {
    return OldImplementation.generateFromInteger(index)
  },
}
