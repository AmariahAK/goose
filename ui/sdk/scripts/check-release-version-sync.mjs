#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const sdkRoot = resolve(scriptDir, "..");
const uiRoot = resolve(sdkRoot, "..");
const repoRoot = resolve(uiRoot, "..");
const binaryRoot = join(uiRoot, "goose-binary");

const BINARY_PACKAGE_PREFIX = "@aaif/goose-binary-";

const cargoVersion = readWorkspaceCargoVersion(join(repoRoot, "Cargo.toml"));
const sdkPackage = readJson(join(sdkRoot, "package.json"));
const binaryPackages = readBinaryPackages(binaryRoot);
const errors = [
  ...validateSdkVersionMatchesGoose(sdkPackage, cargoVersion),
  ...validateBinaryPackageNames(binaryPackages),
  ...validateBinaryPackageVersions(binaryPackages, sdkPackage.version),
  ...validateSdkInstallsAllBinaryPackages(sdkPackage, binaryPackages),
];

if (errors.length > 0) {
  console.error("[release-version-sync] version sync check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  console.error("");
  console.error(
    "[release-version-sync] Expected: Goose, @aaif/goose-sdk, and all @aaif/goose-binary-* packages share one release version.",
  );
  process.exit(1);
}

console.log(
  `[release-version-sync] OK: Goose, SDK, and ${binaryPackages.length} binary package versions are aligned at ${sdkPackage.version}.`,
);

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`failed to read JSON file ${path}`, error);
  }
}

function validateSdkVersionMatchesGoose(sdkPackage, cargoVersion) {
  if (sdkPackage.version === cargoVersion) {
    return [];
  }

  return [
    `SDK version ${sdkPackage.version} does not match Goose workspace version ${cargoVersion}`,
  ];
}

function validateBinaryPackageNames(binaryPackages) {
  return binaryPackages
    .filter((pkg) => !isGooseBinaryPackageName(pkg.name))
    .map((pkg) => `unexpected binary package name ${pkg.name} in ${pkg.path}`);
}

function validateBinaryPackageVersions(binaryPackages, sdkVersion) {
  return binaryPackages
    .filter((pkg) => pkg.version !== sdkVersion)
    .map(
      (pkg) =>
        `${pkg.name} version ${pkg.version} does not match SDK version ${sdkVersion}`,
    );
}

function validateSdkInstallsAllBinaryPackages(sdkPackage, binaryPackages) {
  const publishedBinaryPackageNames = binaryPackages.map((pkg) => pkg.name);
  const sdkBinaryOptionalDeps = readSdkBinaryOptionalDependencies(sdkPackage);

  return [
    ...findMissingSdkBinaryDeps(
      publishedBinaryPackageNames,
      sdkBinaryOptionalDeps,
    ),
    ...findUnknownSdkBinaryDeps(
      sdkBinaryOptionalDeps,
      publishedBinaryPackageNames,
    ),
    ...findInvalidSdkBinaryDepVersions(sdkBinaryOptionalDeps, sdkPackage.version),
  ];
}

function readSdkBinaryOptionalDependencies(sdkPackage) {
  return Object.entries(sdkPackage.optionalDependencies ?? {})
    .filter(([name]) => isGooseBinaryPackageName(name))
    .map(([name, versionSpec]) => ({ name, versionSpec }));
}

function findMissingSdkBinaryDeps(publishedBinaryPackageNames, sdkBinaryDeps) {
  const sdkBinaryDepNames = sdkBinaryDeps.map((dep) => dep.name);

  return publishedBinaryPackageNames
    .filter((name) => !sdkBinaryDepNames.includes(name))
    .map((name) => `SDK optionalDependencies is missing ${name}`);
}

function findUnknownSdkBinaryDeps(sdkBinaryDeps, publishedBinaryPackageNames) {
  return sdkBinaryDeps
    .filter((dep) => !publishedBinaryPackageNames.includes(dep.name))
    .map(
      (dep) => `SDK optionalDependencies includes unknown binary package ${dep.name}`,
    );
}

function findInvalidSdkBinaryDepVersions(sdkBinaryDeps, sdkVersion) {
  return sdkBinaryDeps
    .filter((dep) => !isAllowedOptionalDependencyVersion(dep.versionSpec, sdkVersion))
    .map(
      (dep) =>
        `${dep.name} optional dependency spec ${dep.versionSpec} should be workspace:* locally or ${sdkVersion} in a packed release`,
    );
}

function isAllowedOptionalDependencyVersion(versionSpec, sdkVersion) {
  return versionSpec === "workspace:*" || versionSpec === sdkVersion;
}

function isGooseBinaryPackageName(name) {
  return name?.startsWith(BINARY_PACKAGE_PREFIX);
}

function readWorkspaceCargoVersion(path) {
  const toml = readFileSync(path, "utf8");
  let section = "";

  for (const line of toml.split(/\r?\n/)) {
    const header = line.match(/^\s*\[([^\]]+)]\s*$/);
    if (header) {
      section = header[1];
      continue;
    }

    if (section !== "workspace.package") {
      continue;
    }

    const version = line.match(/^\s*version\s*=\s*"([^"]+)"/);
    if (version) {
      return version[1];
    }
  }

  console.error(
    `[release-version-sync] failed to find workspace.package.version in ${path}`,
  );
  process.exit(1);
}

function readBinaryPackages(root) {
  if (!existsSync(root)) {
    console.error(`[release-version-sync] missing binary package root ${root}`);
    process.exit(1);
  }

  const packages = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name, "package.json"))
    .filter((path) => existsSync(path))
    .map((path) => ({ path, ...readJson(path) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (packages.length === 0) {
    console.error(`[release-version-sync] no binary package manifests found in ${root}`);
    process.exit(1);
  }

  return packages;
}

function fail(message, error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[release-version-sync] ${message}: ${detail}`);
  process.exit(1);
}
