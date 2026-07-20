#!/usr/bin/env node
/**
 * Align package version and peerDependencies with the latest @ai-sdk/harness release.
 *
 * Usage:
 *   npm run sync-peer-versions
 *   npm run sync-peer-versions -- 1.0.36   # pin to a specific harness version
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(__dirname, "..", "package.json");

const requestedVersion = process.argv[2];

async function fetchLatestHarnessVersion() {
  const response = await fetch("https://registry.npmjs.org/@ai-sdk/harness/latest");
  if (!response.ok) {
    throw new Error(`Failed to fetch @ai-sdk/harness version: ${response.status}`);
  }
  const data = await response.json();
  return data.version;
}

async function fetchProviderUtilsVersion(harnessVersion) {
  const response = await fetch(
    `https://registry.npmjs.org/@ai-sdk/harness/${harnessVersion}`,
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch @ai-sdk/harness@${harnessVersion}: ${response.status}`);
  }
  const data = await response.json();
  const providerUtils = data.dependencies?.["@ai-sdk/provider-utils"];
  if (!providerUtils) {
    throw new Error(`@ai-sdk/harness@${harnessVersion} has no @ai-sdk/provider-utils dependency`);
  }
  return providerUtils.replace(/^\^/, "");
}

const harnessVersion = requestedVersion ?? (await fetchLatestHarnessVersion());
const providerUtilsVersion = await fetchProviderUtilsVersion(harnessVersion);

const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
pkg.version = harnessVersion;
pkg.peerDependencies = {
  "@ai-sdk/harness": `^${harnessVersion}`,
  "@ai-sdk/provider-utils": `^${providerUtilsVersion}`,
};
pkg.devDependencies = {
  ...pkg.devDependencies,
  "@ai-sdk/harness": `^${harnessVersion}`,
  "@ai-sdk/provider-utils": `^${providerUtilsVersion}`,
};

writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(
  `Updated @islo-labs/islo-ai-sdk-sandbox to ${harnessVersion} (peer: @ai-sdk/harness ^${harnessVersion}, @ai-sdk/provider-utils ^${providerUtilsVersion})`,
);
