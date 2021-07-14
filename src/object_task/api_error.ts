import type { ERR_PROGRAMMING_ERROR } from "prototype/creep"

export type ApiErrorCode = ERR_PROGRAMMING_ERROR
  | ERR_NO_BODYPART
  | ERR_NOT_OWNER
  | ERR_INVALID_TARGET

/**
 * - 解決に必要な情報
 *   - API種別
 *   - Object識別子
 *   - エラー内容(ERR_XXXX)
 * - 期待した出力が得られなかった場合もここで表現する
 *   - "期待した出力"は計算してStateに保管する
 */
export interface ApiError<Api, ObjectIdentifier> {
  api: Api
  objectIdentifier: ObjectIdentifier
  error: ApiErrorCode
  detail: string | null
}
