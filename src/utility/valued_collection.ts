export class ValuedArrayMap<Key, Element> extends Map<Key, Array<Element>> {
  public getValueFor(key: Key): Element[] {
    const stored = this.get(key)
    if (stored != null) {
      return stored
    }
    const newArray: Element[] = []
    this.set(key, newArray)
    return newArray
  }
}

export class ValuedMapMap<Key, ChildKey, Value> extends Map<Key, Map<ChildKey, Value>> {
  public getValueFor(key: Key): Map<ChildKey, Value> {
    const stored = this.get(key)
    if (stored != null) {
      return stored
    }
    const newMap = new Map<ChildKey, Value>()
    this.set(key, newMap)
    return newMap
  }
}

// fuck
export class ValuedMapArrayMap<Key, ChildKey, Element> extends Map<Key, ValuedArrayMap<ChildKey, Element>> {
  public getValueFor(key: Key): ValuedArrayMap<ChildKey, Element> {
    const stored = this.get(key)
    if (stored != null) {
      return stored
    }
    const newMap = new ValuedArrayMap<ChildKey, Element>()
    this.set(key, newMap)
    return newMap
  }
}
