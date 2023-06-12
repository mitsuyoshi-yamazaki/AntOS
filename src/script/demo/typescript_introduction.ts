/* eslint-disable @typescript-eslint/no-inferrable-types */

// -- Primitive Types --
const a: number = 1
const b: string = "b"

// -- Type Alias --
// 型定義
type X = {
  a: number
  b: string
}

// User Defined Typeの利用
const untypedX = {
  a: 2,
  b: 3,
}
const typedX: X = {
  a: 2,
  b: 3, // Type 'number' is not assignable to type 'string'.
}


type Y = {
  a: number
}

const mutableY: Y = { a: 1 }
mutableY.a = 2

const immutableY: Readonly<Y> = { a: 1 }
immutableY.a = 2 // Cannot assign to 'a' because it is a read-only property.


type Z = string | number
const stringZ: Z = "z"
const numberZ: Z = 1


type A = {
  a: "A"
  b: string
}
type B = {
  a: "B"
  c: boolean
}
type AB = A | B

const ab: AB = {
  a: "A",
  b: "b",
} as AB

if (ab.a === "A") {
  console.log(ab.b)
}

console.log(ab.a)
console.log(ab.b) // Property 'b' does not exist on type 'B'
console.log(ab.c) // Property 'c' does not exist on type 'A'


type ResultSucceeded<T> = {
  readonly case: "succeeded"
  readonly result: T
}
type ResultFailed<Error> = {
  readonly case: "failed"
  readonly error: Error
}
type Result<T, Error> = ResultSucceeded<T> | ResultFailed<Error>

const result: Result<string, string> = ...;

console.log(result.result) // Property 'result' does not exist on type 'ResultFailed<string>'

switch (result.case) { // Result 型の result は ResultSucceeded と ResultFailed に共通する case プロパティをもつ
  case "succeeded":
    // ここではresultはResultSucceeded<string>型
    console.log(result.result)
    break
  case "failed":
    // ここではresultはResultFailed<string>型
    console.log(result.error)
    break
}


type TwitterConnectionDisconnected = {
  readonly case: "disconnected"
}
type TwitterConnectionConnected = {
  readonly case: "connected"
  enabled: boolean
}
type TwitterConnection = TwitterConnectionDisconnected | TwitterConnectionConnected

const tw: TwitterConnection

console.log(`${a} ${b} ${untypedX}, ${typedX}, ${stringZ} ${numberZ}`)
