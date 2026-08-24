# 实现状态

## 已完成并验证

- Tauri v2 + Vanilla TypeScript 项目骨架；
- 自定义应用名称、bundle identifier、CSP、最小 capability 和日历图标；
- 将 `date-picker.7z`、`publish.html` 及资源清单作为 Tauri bundle resources；
- `npm run sync:addon`：从相邻 `date-picker` 工程同步资源、读取 archive root、检查版本并更新 SHA-256；
- Rust 环境检查：WPS 状态、架构、资源哈希、目标目录和 `publish.xml` 一致性；
- Rust 进程内 7z 解压（`sevenz-rust`）、根目录/关键文件/符号链接验证；
- 事务式安装：暂存、备份、原子替换、XML 写入和失败回滚；
- 幂等卸载：仅移除清单中允许的目录，不改 `publish.xml`；
- WPS 结束和重新打开，不执行 `sh -c`；
- 安装/卸载前端确认、忙碌状态、错误信息和诊断信息复制；
- `npm run check`、`cargo +1.88.0 clippy --all-targets -- -D warnings`、`cargo +1.88.0 test`。

## 仍需真实环境验收

- 在真实 WPS 上验证安装、重启后 Ribbon 展示、卸载和覆盖安装；
- 在干净 macOS 用户账户验证无需 Node/Homebrew/系统 7z；
- 分别构建并验收 arm64、x86_64（当前机器的本机构建只覆盖一个架构）；
- Apple Developer ID 签名和 notarization。

## 运行命令

```bash
npm install
npm run check
npm run sync:addon
npm run tauri -- dev
npm run tauri -- build
```

Rust 工具链由 `rust-toolchain.toml` 固定为 `1.88.0`。

