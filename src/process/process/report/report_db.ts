export type PrimaryKey = string

export type IndexTagRawValue = "raw value"
export type IndexTagPlace = "place"
export type IndexTagSubject = "subject"
export type IndexTagActionObject = "action object"
export type IndexTag = IndexTagRawValue | IndexTagPlace | IndexTagSubject | IndexTagActionObject

export type Indexable<T extends (string | number)> = {
  readonly value: T
  readonly indexTags: IndexTag[]
}

export type Storable = {
  readonly primaryKey: PrimaryKey
}

const DBIndex = {
  add(): void {
  },

  update(): void {
  },

  delete(): void {
  },

  get<T extends Storable>(): T | null {
    return null // TODO:
  },

  query<T extends Storable>(): T[] {
    return [] // TODO:
  },
}

export type ReportDB = {
}

