import { readFileSync, writeFileSync } from "node:fs";

const nextEnvPath = "next-env.d.ts";
const stableRoutesReference = '/// <reference path="./.next/types/routes.d.ts" />';
const contents = readFileSync(nextEnvPath, "utf8");
const restored = contents.replace(
  /^\/\/\/ <reference path="\.\/\.[^"]+\/types\/routes\.d\.ts" \/>$/m,
  stableRoutesReference
);

if (restored !== contents) {
  writeFileSync(nextEnvPath, restored);
}
