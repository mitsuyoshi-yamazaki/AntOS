export interface ScopeConstructor {
  new (name: string, owned_controllers: StructureController[]): ScopeInterface
}

export interface ScopeInterface {
  run(): void
}

export function createScope(scope: ScopeConstructor, name: string, owned_controllers: StructureController[]): ScopeInterface {
  return new scope(name, owned_controllers)
}
