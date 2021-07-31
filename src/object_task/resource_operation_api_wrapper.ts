export interface ResourceOperationApiWrapper {
  resourceType: ResourceConstant
  resourceOperationDescription: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isResourceOperationApiWrapper(arg: any): arg is ResourceOperationApiWrapper {
  return arg.resourceType !== undefined && arg.resourceOperationDescription !== undefined
}
