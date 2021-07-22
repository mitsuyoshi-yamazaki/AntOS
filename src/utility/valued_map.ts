export class ValuedArrayMap<Key, Element> extends Map<Key, Array<Element>> {
  public get(key: Key): Element[] {
    const stored = super.get(key)
    if (stored != null) {
      return stored
    }
    const newArray: Element[] = []
    this.set(key, newArray)
    return newArray
  }
}
