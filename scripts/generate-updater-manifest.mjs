// Generates the Tauri updater manifest (latest.json) from signed release
// assets. The manifest is consumed by tauri-plugin-updater; signatures are
// embedded here and the client verifies them against the pubkey baked into
// the app, so GitHub is an untrusted transport.
//
// Usage: node scripts/generate-updater-manifest.mjs <assets-dir> <tag> <repo> [output]

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [assetsDir, tag, repo, output = "latest.json"] = process.argv.slice(2);

if (!assetsDir || !tag || !repo) {
  console.error("Usage: node scripts/generate-updater-manifest.mjs <assets-dir> <tag> <repo> [output]");
  process.exit(1);
}

const version = tag.replace(/^v/, "");
const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
if (config.version !== version) {
  console.error(`Version mismatch: tauri.conf.json is ${config.version}, tag is ${version}.`);
  process.exit(1);
}

const baseUrl = `https://github.com/${repo}/releases/download/${tag}`;

// Longer suffixes are listed first so e.g. ...macos_arm64.app.tar.gz matches
// before ...app.tar.gz.
const rules = [
  {
    suffix: "_macos_arm64.app.tar.gz",
    platform: "darwin-aarch64",
  },
  {
    suffix: "_macos_x64.app.tar.gz",
    platform: "darwin-x86_64",
  },
  {
    suffix: "_windows_x64-setup.exe",
    platform: "windows-x86_64",
  },
];

const files = readdirSync(assetsDir);
const platforms = {};

for (const rule of rules) {
  const file = files.find((name) => name.endsWith(rule.suffix));
  if (!file) continue;
  const sigFile = `${file}.sig`;
  if (!files.includes(sigFile)) {
    console.error(`Missing signature for ${file} in ${assetsDir}`);
    process.exit(1);
  }
  platforms[rule.platform] = {
    signature: readFileSync(join(assetsDir, sigFile), "utf8").trimEnd(),
    url: `${baseUrl}/${encodeURIComponent(file)}`,
  };
}

if (Object.keys(platforms).length === 0) {
  console.error(`No signed updater assets found in ${assetsDir}`);
  process.exit(1);
}

const manifest = {
  version,
  notes: `Release ${tag}`,
  pub_date: new Date().toISOString(),
  platforms,
};

writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${output} with ${Object.keys(platforms).length} platform(s).`);
