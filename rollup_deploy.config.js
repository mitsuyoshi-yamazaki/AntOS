"use strict";

import screeps from "rollup-plugin-screeps";

let cfg;
const dest = process.env.DEST;
if (!dest) {
  console.log("No destination specified - code will be compiled but not uploaded");
} else if ((cfg = require("./screeps")[dest]) == null) {
  throw new Error("Invalid upload destination");
}

export default {
  input: "dist/main.js",
  output: {
    file: "dist/main.js",
    format: "cjs",
    sourcemap: false
  },

  plugins: [
    screeps({config: cfg, dryRun: cfg == null})
  ]
}
