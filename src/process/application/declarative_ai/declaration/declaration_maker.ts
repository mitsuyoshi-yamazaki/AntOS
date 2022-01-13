import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Declaration } from "process/temporary/world_35872159_test_resource_pool_process"

type DeclarationTypeName = string

type Maker = (declarationTypeName: DeclarationTypeName, args: Map<string, string>) => Declaration | null

const makers = new Map<DeclarationTypeName, Maker>()

export const DeclarationMaker = {
  register(declarationTypeName: DeclarationTypeName, maker: Maker): void {
    if (makers.has(declarationTypeName) === true) {
      PrimitiveLogger.fatal(`DeclarationMaker registering ${declarationTypeName} twice ${Game.time}`)
    }
    makers.set(declarationTypeName, maker)
  },

  create(declarationTypeName: DeclarationTypeName, args: Map<string, string>): Declaration | null {
    const maker = makers.get(declarationTypeName)
    if (maker == null) {
      PrimitiveLogger.programError(`DeclarationMaker unregistered declaration ${declarationTypeName}`)
      return null
    }
    return maker(declarationTypeName, args)
  },
}
