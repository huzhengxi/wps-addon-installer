import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, rmSync } from "node:fs";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const tauriDirectory = resolve(projectRoot, "src-tauri");
const childEnvironment = {
  ...process.env,
  PATH: [dirname(process.execPath), process.env.PATH].filter(Boolean).join(delimiter)
};

function optionValue(args, longName, shortName) {
  const inline = args.find((argument) => argument.startsWith(`${longName}=`));
  if (inline) return inline.slice(longName.length + 1);

  const index = args.findIndex((argument) => argument === longName || argument === shortName);
  return index >= 0 ? args[index + 1] : undefined;
}

function architectureName(target) {
  if (target === "universal-apple-darwin") return "universal";
  if (target?.startsWith("aarch64-")) return "arm64";
  if (target?.startsWith("x86_64-")) return "x64";
  return process.arch === "arm64" ? "arm64" : "x64";
}

function printHelp() {
  console.log(`创建可直接运行的 macOS .app ZIP 包。

用法：
  npm run package:zip
  npm run package:zip -- --target aarch64-apple-darwin
  npm run package:zip -- --target x86_64-apple-darwin
  npm run package:zip -- --target universal-apple-darwin

其他参数会继续传给 tauri build，例如 --debug 或 --no-sign。`);
}

const buildArguments = process.argv.slice(2);
if (buildArguments.includes("--help") || buildArguments.includes("-h")) {
  printHelp();
  process.exit(0);
}

if (process.platform !== "darwin") {
  throw new Error("ZIP 应用包只能在 macOS 上构建。");
}

if (buildArguments.some((argument) => ["--bundles", "-b", "--no-bundle"].includes(argument) || argument.startsWith("--bundles="))) {
  throw new Error("package:zip 已固定使用 app bundle，不能再传入 --bundles 或 --no-bundle。");
}

const target = optionValue(buildArguments, "--target", "-t");
if (target === "--debug" || target === "-d") {
  throw new Error("--target 后必须提供 Rust 目标名称。");
}

const debug = buildArguments.includes("--debug") || buildArguments.includes("-d");
const profile = debug ? "debug" : "release";
const targetDirectory = target
  ? resolve(tauriDirectory, "target", target, profile)
  : resolve(tauriDirectory, "target", profile);
const bundleDirectory = resolve(targetDirectory, "bundle", "macos");

const tauriConfig = JSON.parse(readFileSync(resolve(tauriDirectory, "tauri.conf.json"), "utf8"));
const packageConfig = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8"));
const appPath = resolve(bundleDirectory, `${tauriConfig.productName}.app`);
const embeddedManifest = resolve(appPath, "Contents", "Resources", "addon", "addon-manifest.json");
const archiveName = `${packageConfig.name}_${tauriConfig.version}_${architectureName(target)}.zip`;
const archivePath = resolve(bundleDirectory, archiveName);
const temporaryArchivePath = `${archivePath}.tmp`;
const tauriCli = resolve(projectRoot, "node_modules", "@tauri-apps", "cli", "tauri.js");

if (!existsSync(tauriCli)) {
  throw new Error("未找到 Tauri CLI，请先运行 npm install。");
}

console.log("正在构建 macOS .app…");
execFileSync(process.execPath, [tauriCli, "build", "--bundles", "app", ...buildArguments], {
  cwd: projectRoot,
  stdio: "inherit",
  env: childEnvironment
});

if (!existsSync(appPath)) {
  throw new Error(`Tauri 构建完成，但没有找到应用：${appPath}`);
}
if (!existsSync(embeddedManifest)) {
  throw new Error(`应用缺少离线加载项资源：${embeddedManifest}`);
}

rmSync(temporaryArchivePath, { force: true });
console.log("正在压缩 .app…");
execFileSync("/usr/bin/ditto", [
  "-c",
  "-k",
  "--sequesterRsrc",
  "--keepParent",
  appPath,
  temporaryArchivePath
], { stdio: "inherit" });
renameSync(temporaryArchivePath, archivePath);

console.log(`ZIP 打包完成：${archivePath}`);
