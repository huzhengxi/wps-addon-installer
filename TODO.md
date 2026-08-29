# 待办

已完成的工程骨架、资源同步、安装/卸载流程、安全路径控制、最小 UI 和 bundle resources 见 [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)。本文件只保留尚未完成或尚未在目标环境验收的工作。

## P0：发布前验收

- [ ] **修复并验证 Windows 安装包构建**
  - GitHub Actions 中确认 WiX MSI 在启用 VBSCRIPT 后能产出 `.msi`；
  - 确认 NSIS 同时产出 `.exe`；
  - 在干净 Windows 环境完成安装、覆盖安装、卸载和 WPS 重启验证。

- [ ] **完成 macOS 真实环境验收**
  - 在真实 WPS 表格中确认安装或覆盖安装后 Ribbon 出现“日期选择器”；
  - 验证卸载后 WPS 能重新打开；
  - 在干净 macOS 用户账户中验证离线安装，无 Node、Homebrew 或系统 7z。

- [ ] **覆盖两种 macOS 架构**
  - 构建并验收 Apple Silicon arm64 `.dmg`；
  - 构建并验收 Intel x86_64 `.dmg`；
  - 记录各架构的验收结果和测试环境。

- [ ] **补齐 CI 质量门禁**
  - 在 CI 中执行 Rust fmt、clippy 和 test；
  - 保留前端 typecheck/build；
  - 为安装流程的关键失败场景保留可重复运行的测试记录。

- [ ] **验收 tag 发布流程**
  - 推送新的 `v*` tag；
  - 确认 GitHub Release 附带 macOS、Windows 和 Linux 安装包；
  - 确认用户侧下载路径只使用 Release 附件，Actions Artifacts 仅用于构建检查与排障。

## P1：发布可靠性与维护

- [ ] 完成 Apple Developer ID 签名、notarization 和正式分发配置；
- [ ] 决定卸载时是否定向清理 `publish.xml`，并补 XML 解析测试；
- [ ] 将安装时的 `publish.xml` 写入升级为只更新 date-picker、保留其他加载项；
- [ ] 增加安装前后差异预览和本地操作历史；
- [ ] 增加“仅重启 WPS”和“打开安装目录”辅助操作；
- [ ] 支持自动发现非标准 WPS 安装位置；
- [ ] 评估 universal binary，减少用户选择架构的成本；
- [x] 设计应用自动更新：Tauri Updater + GitHub Releases + minisign 签名；首个带更新器的版本发布后，后续版本可自动更新。

## 软件更新模块未完成事项

- [x] 配置 GitHub Secrets：`TAURI_SIGNING_PRIVATE_KEY`、`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`；
- [x] 本地验证 macOS 签名产物：`npm run package:zip -- --target x86_64-apple-darwin` 产出 `WPSAddonInstaller.app.tar.gz` 和 `.sig`。
- [x] 提交改动并发布首个 updater 版本 v0.0.10：Actions 构建成功，Release 资产齐全，`latest.json` 平台/签名/URL 正确；
- [x] 验证真实自动更新：v0.0.10 成功检测并更新到 v0.0.11，下载、验签、安装、重启均通过。
- [ ] macOS Apple Developer ID 签名与公证接入发布 workflow。

## P2：扩展能力

- [ ] **完成 Windows 真实环境验收**
  - [x] 实现 WPS 探测（注册表 InstallRoot / LOCALAPPDATA 扫描）、版本检查、jsaddons 部署与进程重启；
  - [ ] 在干净 Windows 环境完成安装、覆盖安装、卸载和 WPS 重启验证；
  - [ ] 确认个人版 WPS 上 publish.xml 流程加载正常。
- [ ] 支持多个 WPS 加载项及多版本切换；
- [ ] 支持企业离线包、静默安装参数和管理日志导出；
- [ ] 国际化与无障碍专项验收。

## 发布完成定义

满足以下条件后，首个正式版本才可发布：

1. macOS arm64 与 x86_64 均通过真实 WPS 验收；
2. Windows 的 MSI 与 NSIS 安装包均成功构建并完成基础安装验收；
3. 安装、覆盖安装和卸载可重复执行，且不会删除 `jsaddons` 中无关内容；
4. tag workflow 创建的 GitHub Release 包含所有目标平台的安装包；
5. Release 下载的产物完成签名与公证要求，或明确标记为未签名测试版。
