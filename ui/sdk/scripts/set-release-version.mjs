#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
if (!version) {
  console.error("usage: node scripts/set-release-version.mjs <version>");
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+(?:-.+)?$/.test(version)) {
  console.error(`invalid version "${version}"`);
  process.exit(1);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const sdkRoot = resolve(scriptDir, "..");
const uiRoot = resolve(sdkRoot, "..");
const binaryRoot = join(uiRoot, "goose-binary");

const packageJsonPaths = [
  join(sdkRoot, "package.json"),
  ...readBinaryPackageJsonPaths(binaryRoot),
];

for (const path of packageJsonPaths) {
  const pkg = readJson(path);
  pkg.version = version;
  writeJson(path, pkg);
}

console.log(
  `[set-release-version] updated ${packageJsonPaths.length} npm package manifests to ${version}`,
);

function readBinaryPackageJsonPaths(root) {
  if (!existsSync(root)) {
    console.error(`[set-release-version] missing binary package root ${root}`);
    process.exit(1);
  }

  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name, "package.json"))
    .filter((path) => existsSync(path))
    .sort();
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
