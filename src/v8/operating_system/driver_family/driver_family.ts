/**
 # DriverFamily
 ## 概要
 DriverFamilyはBotの認知の基礎を成すDriverの集合
 BotはOS上で動作するDriverとProcessの集合

 ## 仕様
 Botのidentifierはmajor versionと対応する
 */

import { Beryllium } from "../driver/beryllium"

export const DriverFamily = {
  Beryllium: Beryllium,
}
