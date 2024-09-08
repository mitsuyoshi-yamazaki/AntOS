import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { Command, runCommands } from "../command"

// Commands
import { TestCommand } from "./exec_commands/test_command"


const commandRunners: Command[] = [
  TestCommand,
]


export const AliasCommand: Command = {
  command: "exec",

  help(): string {
    return "exec {command} {...args}"
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string {
    return runCommands(argumentParser, commandRunners)
  },
}


/**
# Alias
## 概要
- コマンドのaliasを行えるようにする

## 例
- 'status {PID}' => 'message {PID} status'

## 要件
- 1. 固定値の入力を固定値のコマンドにaliasできる
- 2. 変数入力ができる
- 3. 複数のコマンド実行を行うことができる
- 4. aliasのaliasを設定できる
- 5. alias先に引き継ぐ引数を設定できる

## 全体仕様
- aliasはコマンドを作成するという形になる
  - 既存のコマンドを上書きすることはできない
  - alias済みのコマンドに別のaliasを設定することはできない

## 仕様(1)
### Alias設定
- alias '{入力}' '{コマンド}'

### Alias実行
- 入力値全体がaliasに合致したら

## 仕様(2)
- 変数入力ができる
- ひとつの引数を複数箇所の変数に入力することができる

### Alias設定
- aliasコマンド, 引数一覧, ヘルプテキスト, alias先
- 'short_command {list_arg1},{list_arg2},{keyword_arg1}=,{keyword_arg2}= '
  - 引数が大きいので対話式にした方が良い
    - → 対話式コマンドを処理する一時プロセスの具象プロセスでalias生成をする

### Alias実行
- Alias判定
  - how?
  - Aliasもコマンドをつくる形
- 引数抽出
- 引数で変数を置換する

## 仕様(3)
### Alias設定

### Alias実行

## 仕様(4)
### Alias設定

### Alias実行
 */

type Alias = {
  readonly command: string
  readonly listArgumentNames: string[]
  readonly keywordArgumentNames: string[]
  readonly aliasCommand: string
  readonly helpText: string
}

export const makeAlias = (argumentParser: ArgumentParser): Alias => {
  throw "not implemented yet"
}
