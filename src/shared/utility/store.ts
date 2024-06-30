import { strictEntries } from "./strict_entries"

export const storedResourceTypes = (store: StoreDefinition): ResourceConstant[] => {
  return strictEntries<Record<ResourceConstant, number>>(store).map(([resourceType,]) => resourceType)
}
