"use strict";

import clear from "rollup-plugin-clear";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import screeps from "rollup-plugin-screeps";
import wasm from "@rollup/plugin-wasm";
import copy from "rollup-plugin-copy";

let cfg;
const dest = process.env.DEST;
if (!dest) {
  console.log("No destination specified - code will be compiled but not uploaded");
} else if ((cfg = require("./screeps.json")[dest]) == null) {
  throw new Error("Invalid upload destination");
}

export default {
  input: "src/main.ts",
  output: {
    file: "dist/main.js",
    format: "cjs",
    sourcemap: true,
    exports: "auto"
  },

  external: ["screeps_clockwork.wasm"],
  plugins: [
    clear({ targets: ["dist"] }),
    wasm(),
    copy({
      targets: [{ src: "node_modules/screeps-clockwork/dist/screeps_clockwork.wasm", dest: "dist" }]
    }),
    resolve({ rootDir: "src" }),
    commonjs(),
    typescript({ tsconfig: "./tsconfig.json" }),
    screeps({ config: cfg, dryRun: cfg == null })
  ]
};
