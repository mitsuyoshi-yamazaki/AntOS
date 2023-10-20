
type SomeUnionType = "a" | "b" | "c"

const SomeUnionTypeValues = Object.values<SomeUnionType>({} as unknown as SomeUnionType);
console.log(SomeUnionTypeValues);

