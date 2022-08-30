/**
 # RootProcess
 ## 概要
 v2系OSの最上位Process
 Application Processはこの直下に位置する

 ## 仕様
 最上位に位置するため親がいないなど性格が異なり、Processを継承するオブジェクトではない
 */

import { rootProcessId } from "./process_type"

export class RootProcess {
  public readonly processId = rootProcessId

  public constructor() {}

  public run(): void {
  }
}
