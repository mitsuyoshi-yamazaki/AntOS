import { RootProcess } from "./root_process";
import { V8TestProcess } from "./temporary/v8_test_process";

export type AnyProcess = RootProcess
  | V8TestProcess
