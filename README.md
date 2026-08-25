# WPS 加载项安装器

这是 `date-picker` WPS 加载项的 macOS 桌面安装器规划工程。目标是使用 Tauri v2 提供可视化的安装、卸载和状态检查，并把加载项构建产物随应用一同离线分发。

当前阶段只完成了：

- 项目整体架构；
- `install.sh` / `uninstall.sh` 行为契约；
- 分阶段 To-do 和验收标准；
- 当前 `wps-addon-build`、`wps-addon-publish` 的资源快照；
- 资源清单与 SHA-256 校验值。

已实现首版前端、Rust 安装/卸载命令、资源校验、同步脚本和单元测试；真实 WPS 验收、双架构 DMG、签名和公证仍需在目标机器完成。

## 本地运行

```bash
cd /Users/jason/src/liqiong/wps-addon-installer
npm install
npm run tauri dev
```

首次构建需要 Rust `1.88.0`（工程已通过 `rust-toolchain.toml` 固定）。资源更新使用：

```bash
npm run sync:addon
```

## 打包

现有 DMG 打包方式保持不变：

```bash
npm run tauri -- build
```

也可以生成无需安装、解压后直接运行的 `.app` ZIP 包：

```bash
npm run package:zip
```

ZIP 默认输出到 `src-tauri/target/release/bundle/macos/`。脚本使用 macOS 自带的 `ditto` 压缩，以保留 `.app` 的执行权限、扩展属性和签名信息。指定架构时可使用：

```bash
npm run package:zip -- --target aarch64-apple-darwin
npm run package:zip -- --target x86_64-apple-darwin
npm run package:zip -- --target universal-apple-darwin
```

未签名或未公证的应用仍可能触发 macOS Gatekeeper 提示；正式对外分发时，ZIP 内的 `.app` 与 DMG 版本一样需要完成 Developer ID 签名和公证。

各平台也可分别构建对应的安装包：

```bash
npm run package:macos    # macOS：DMG
npm run package:windows  # Windows：MSI、NSIS 安装程序
npm run package:linux    # Linux：AppImage、DEB
```

安装包需要在对应的操作系统上构建，不能在一台电脑上直接生成全部平台的原生包。可在 GitHub Actions 的 **Package desktop app** 工作流中选择 `all` 一次构建 macOS、Windows、Linux，或选择单一平台；产物会作为 workflow artifacts 上传。

> Windows 和 Linux 的安装器目前仅保证可以构建。应用的 WPS 探测、安装、卸载和重启逻辑仍只支持 macOS，运行时会显示“不支持的系统”；在实现对应的 WPS 路径和进程控制前，不应对外发布这两个平台的包。

## 第一版范围

- 平台：macOS；
- WPS：`com.kingsoft.wpsoffice.mac`；
- 加载项：`date-picker`，类型 `et`；
- 支持离线安装、卸载、安装状态检查、WPS 重启；
- 应用内携带 `wps-addon-build` 和 `wps-addon-publish`；
- 不依赖当前源码工程、Node.js、Homebrew 或系统 `7z`。

Windows、Linux、在线升级、多加载项管理和应用自动更新暂不纳入第一版。

## 关键发现

当前构建包的根目录是 `date-picker_1.0.1`，`package.json` 也是 `1.0.1`，但现有 `install.sh` 与 `uninstall.sh` 仍写死为 `1.0.0`。直接运行旧安装脚本会因为找不到 `date-picker_1.0.0` 而失败。

新应用以 [addon-manifest.json](./src-tauri/resources/addon/addon-manifest.json) 作为唯一版本来源，当前确定为 `1.0.1`；实现时不得再在 Rust、TypeScript 或配置文件中重复硬编码版本。

## 文档入口

- [ARCHITECTURE.md](./ARCHITECTURE.md)：模块、数据流、目录和技术决策；
- [TODO.md](./TODO.md)：实现顺序与验收标准；
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)：已实现内容与仍需实机验收项；
- [docs/install-contract.md](./docs/install-contract.md)：脚本行为到 Tauri 行为的逐项映射；
- [docs/decisions.md](./docs/decisions.md)：已确定事项与待确认事项。

## 官方参考

- [Tauri v2：嵌入额外资源](https://v2.tauri.app/develop/resources/)
- [Tauri v2：前端调用 Rust](https://v2.tauri.app/develop/calling-rust/)
- [Tauri v2：Capabilities](https://v2.tauri.app/security/capabilities/)
