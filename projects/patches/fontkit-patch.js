// @ts-check
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const target = path.join(__dirname, "..", "node_modules", "fontkit", "dist", "module.mjs");

if (!fs.existsSync(target)) {
  console.warn("[patch] fontkit module.mjs not found, skipping");
  process.exit(0);
}

let code = fs.readFileSync(target, "utf8");
const before = 'import {applyDecoratedDescriptor as ';
const after = 'import {_apply_decorated_descriptor as ';

if (code.includes(before)) {
  code = code.replaceAll(before, after);
  fs.writeFileSync(target, code, "utf8");
  console.log("[patch] fontkit module.mjs patched successfully");
} else if (code.includes(after)) {
  console.log("[patch] fontkit module.mjs already patched, skipping");
} else {
  console.warn("[patch] unexpected fontkit module.mjs format, skipping");
}
