export interface ObjectTaskProfit<ObjectType, Performance> {
  estimate(obj: ObjectType): Performance
  performance(): Performance
}
