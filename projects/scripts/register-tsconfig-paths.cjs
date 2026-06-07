/* eslint-disable @typescript-eslint/no-require-imports */
const Module = require("module");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const srcRoot = path.join(projectRoot, "src");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    const mapped = path.join(srcRoot, request.slice(2));
    return originalResolveFilename.call(this, mapped, parent, isMain, options);
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};
