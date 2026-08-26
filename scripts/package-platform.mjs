import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const tauriCli = resolve(projectRoot, "node_modules", "@tauri-apps", "cli", "tauri.js");
const childEnvironment = {
  ...process.env,
  PATH: [dirname(process.execPath), process.env.PATH].filter(Boolean).join(delimiter)
};

const packages = {
  macos: { host: "darwin", bundles: "app" },
  windows: { host: "win32", bundles: "nsis" },
  linux: { host: "linux", bundles: "appimage" }
};

function printHelp() {
  console.log(`在当前系统打包 Tauri 应用。

用法：
  node scripts/package-platform.mjs <macos|windows|linux> [Tauri build 参数]

示例：
  npm run package:macos
  npm run package:windows -- --debug
  npm run package:linux -- --target x86_64-unknown-linux-gnu

跨平台安装包必须在对应系统上构建。请使用 GitHub Actions 的 package 工作流一次构建全部平台。`);
}

const [platform, ...buildArguments] = process.argv.slice(2);
if (!platform || platform === "--help" || platform === "-h") {
  printHelp();
  process.exit(platform ? 0 : 1);
}

const packageConfig = packages[platform];
if (!packageConfig) {
  printHelp();
  throw new Error(`不支持的打包平台：${platform}`);
}

if (process.platform !== packageConfig.host) {
  throw new Error(
    `${platform} 安装包必须在对应系统构建；当前系统为 ${process.platform}。` +
      "请使用 GitHub Actions 的 package 工作流，或在对应系统上执行此命令。"
  );
}

if (!existsSync(tauriCli)) {
  throw new Error("未找到 Tauri CLI，请先运行 npm ci。");
}

console.log(`正在构建 ${platform} 安装包（${packageConfig.bundles}）…`);
execFileSync(process.execPath, [tauriCli, "build", "--bundles", packageConfig.bundles, ...buildArguments], {
  cwd: projectRoot,
  stdio: "inherit",
  env: childEnvironment
});
