import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(process.env.ADDON_SOURCE_DIR ?? resolve(projectRoot, "..", "date-picker"));
const resourcesRoot = resolve(projectRoot, "src-tauri/resources/addon");
const archiveSource = resolve(sourceRoot, "wps-addon-build/date-picker.7z");
const publishSource = resolve(sourceRoot, "wps-addon-publish/publish.html");
const archiveTarget = resolve(resourcesRoot, "wps-addon-build/date-picker.7z");
const publishTarget = resolve(resourcesRoot, "wps-addon-publish/publish.html");
const manifestTarget = resolve(resourcesRoot, "addon-manifest.json");
const shouldBuild = !process.argv.includes("--skip-build");

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function archiveRoot() {
  const candidateArchitectures = [...new Set([process.arch === "x64" ? "x64" : process.arch, "arm64", "x64"] )];
  let output;
  let lastError;
  for (const architecture of candidateArchitectures) {
    try {
      output = execFileSync(resolve(sourceRoot, `node_modules/7zip-bin/mac/${architecture}/7za`), ["l", archiveSource], { encoding: "utf8" });
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!output) throw lastError ?? new Error("找不到可运行的 7za 工具。");
  const match = output.match(/^\d{4}-\d{2}-\d{2}.*?D\.\.\.\.\s+\d+\s+\d+\s+(date-picker_[^\s/]+)$/m);
  if (!match) throw new Error("无法从 7z 包中识别唯一的 date-picker 根目录。");
  return match[1];
}

if (shouldBuild) {
  execFileSync("npm", ["run", "build"], { cwd: sourceRoot, stdio: "inherit" });
}

await mkdir(dirname(archiveTarget), { recursive: true });
await mkdir(dirname(publishTarget), { recursive: true });
await copyFile(archiveSource, archiveTarget);
await copyFile(publishSource, publishTarget);

const [packageJson, archive, publish, archiveInfo] = await Promise.all([
  readFile(resolve(sourceRoot, "package.json"), "utf8").then(JSON.parse),
  readFile(archiveTarget),
  readFile(publishTarget),
  stat(archiveTarget)
]);
const version = packageJson.version;
const root = archiveRoot();
if (root !== `date-picker_${version}`) {
  throw new Error(`版本不一致：package.json 为 ${version}，压缩包根目录为 ${root}。`);
}

const manifest = {
  schemaVersion: 1,
  name: "date-picker",
  displayName: "日期选择器",
  addonType: "et",
  version,
  archive: "wps-addon-build/date-picker.7z",
  archiveRoot: root,
  archiveSize: archiveInfo.size,
  archiveSha256: sha256(archive),
  publishArtifact: "wps-addon-publish/publish.html",
  publishArtifactSha256: sha256(publish),
  legacyDirectoryNames: [`date-picker_v${version}`, "date-picker_1.0.0", "date-picker_v1.0.0"],
  wps: {
    bundleId: "com.kingsoft.wpsoffice.mac",
    applicationPath: "/Applications/wpsoffice.app",
    jsAddonsRelativeToHome: "Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons"
  }
};
await writeFile(manifestTarget, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`已同步 date-picker ${version} 到 ${resourcesRoot}`);
