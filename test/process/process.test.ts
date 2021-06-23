import { isProcedural, Procedural } from "../../src/task/process"

class SomeObject { }

test("isProcedural()", () => {
  class SomeProceduralObject implements Procedural {
    public runOnTick(): void { }
  }

  expect(isProcedural(new SomeProceduralObject())).toBe(true)
  expect(isProcedural(new SomeObject())).toBe(false)
})
