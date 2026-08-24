# 整体架构

## 1. 架构目标

安装器采用 Tauri v2：前端只负责显示状态和发起明确操作，所有文件校验、解压、复制、删除以及 WPS 进程控制都在 Rust 后端完成。

选择这种边界的原因是安装流程涉及用户目录写入和进程操作，不应允许 WebView 传入任意文件路径或任意命令。Tauri 官方支持通过 `bundle.resources` 打包额外文件，也支持使用 command 在前端与 Rust 之间传递结构化结果。

## 2. 目标目录结构

```text
wps-addon-installer/
├── README.md
├── ARCHITECTURE.md
├── TODO.md
├── docs/
│   ├── decisions.md
│   └── install-contract.md
├── package.json                   # Tauri CLI + Vanilla TypeScript/Vite
├── index.html
├── src/
│   ├── main.ts                    # 页面状态与 command 调用
│   ├── api.ts                     # Rust command 的类型化封装
│   ├── state.ts                   # idle/checking/installing/uninstalling/result
│   └── styles.css
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/
    │   └── main.json              # 仅主窗口、最小权限
    ├── resources/
    │   └── addon/
    │       ├── addon-manifest.json
    │       ├── wps-addon-build/
    │       │   └── date-picker.7z
    │       └── wps-addon-publish/
    │           └── publish.html
    └── src/
        ├── lib.rs                 # Tauri builder 与 command 注册
        ├── commands.rs            # inspect/install/uninstall/restart
        ├── model.rs               # DTO、状态、错误码
        └── installer/
            ├── mod.rs             # 用例编排与互斥锁
            ├── manifest.rs        # 资源清单解析与校验
            ├── paths.rs           # 固定路径解析及越界防护
            ├── archive.rs         # 7z 解压适配层
            ├── transaction.rs     # 暂存、备份、提交、回滚
            ├── publish_xml.rs     # publish.xml 生成与原子写入
            └── wps.rs             # 检测、结束和重新打开 WPS
```

第一版前端推荐 Vanilla TypeScript + Vite，不引入 React/Vue。页面只有单一状态面板和两个操作按钮，不需要额外框架。

## 3. 运行时组件

### 3.1 前端

前端只调用以下固定 command，不传入路径、程序名或 shell 参数：

- `inspect_environment()`：返回 WPS、载荷和安装状态；
- `install_addon()`：安装清单中唯一的加载项；
- `uninstall_addon()`：卸载清单中唯一的加载项；
- `restart_wps()`：在用户选择重试时单独重启 WPS。

建议返回统一结构：

```ts
type OperationResult<T> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; recoverable: boolean };
};
```

长操作用 Tauri channel 或事件报告阶段，不把完整文件内容通过 IPC 传输：

```text
validate_payload → extract → stage → write_config → restart_wps → done
```

### 3.2 Rust 安装域

Rust 后端是唯一允许修改文件系统的组件。所有操作都由 `addon-manifest.json` 派生：名称、版本、压缩包路径、压缩包根目录、校验值和可清理的旧目录名。

服务职责：

- `manifest`：读取随包资源，拒绝缺字段或不支持的 schema；
- `paths`：解析 Tauri resource 目录和当前用户的 WPS 加载项目录；
- `archive`：解压到系统临时目录并防止路径穿越；
- `transaction`：先暂存再替换，失败时恢复原加载项及 `publish.xml`；
- `publish_xml`：生成与 `install.sh` 等价的单加载项 XML，并原子替换；
- `wps`：检测 `/Applications/wpsoffice.app`、结束 `wpsoffice`、等待并重新打开；
- `commands`：向 UI 暴露有限用例，不暴露通用文件或 shell 能力。

### 3.3 解压策略

首选 Rust 进程内 7z 解压库，避免把 Node.js、`node_modules`、Homebrew 或 shell 作为运行依赖。P0 技术验证必须使用当前 `date-picker.7z` 做真实解压测试。

如果所选 Rust 库无法稳定解压当前 LZMA2 归档，再退回到 Tauri sidecar：分别携带 arm64 和 x86_64 的 `7za`，并完成许可证审查。不得依赖开发工程下的 `node_modules/7zip-bin`。

## 4. 资源打包

在 `tauri.conf.json > bundle > resources` 中只声明：

```json
[
  "resources/addon/addon-manifest.json",
  "resources/addon/wps-addon-build/date-picker.7z",
  "resources/addon/wps-addon-publish/publish.html"
]
```

运行时通过 Tauri Resource 基目录解析。`wps-addon-publish/publish.html` 按需求随应用打包，但现有安装脚本不读取它，因此第一版安装流程也不执行或打开它。

构建前应由一个同步脚本从 `../date-picker` 复制两类产物并重算哈希；CI 在资源过期、缺失或 archive root 与清单不一致时直接失败。不要依赖开发人员手工复制。

## 5. 安装流程

```text
用户点击安装
  → 获取全局操作锁，禁止重复点击
  → 读取并校验 addon-manifest.json
  → 校验两个资源存在并核对 SHA-256
  → 在系统临时目录解压 date-picker.7z
  → 验证唯一顶层目录为 date-picker_1.0.1
  → 验证关键文件（manifest.xml、index.html、main.js）
  → 创建 WPS jsaddons 目录
  → 在 jsaddons 内创建同文件系统暂存目录
  → 复制加载项到暂存目录并再次验证
  → 备份现有目标目录和 publish.xml
  → 原子替换目标目录
  → 原子写入与脚本等价的 publish.xml
  → 删除备份和临时目录
  → 结束并重新打开 WPS
  → 刷新安装状态并返回成功
```

如果提交前失败，只清理临时目录；如果目标替换或 XML 写入后失败，则尝试回滚目标目录和 `publish.xml`。WPS 重启失败不回滚已经成功的安装，而是返回“已安装但重启失败”的可恢复结果。

## 6. 卸载流程

```text
用户确认卸载
  → 获取全局操作锁
  → 读取并校验清单
  → 解析且验证所有可清理目录都直属于 jsaddons
  → 删除当前目录和清单列出的旧格式目录
  → 不修改 publish.xml（与当前 uninstall.sh 一致）
  → 结束并重新打开 WPS
  → 刷新状态并返回成功
```

“不修改 `publish.xml`”是对当前脚本行为的忠实复现，但会遗留无效配置。是否恢复脚本中已注释的定向清理逻辑，作为 P1 产品决策单独处理，不能在实现时悄悄改变。

## 7. 安装状态

`inspect_environment()` 至少返回：

- 当前 CPU 架构；
- WPS 应用是否存在、是否正在运行；
- `jsaddons` 路径是否可创建/写入；
- 内置载荷名称、版本、哈希校验结果；
- 目标目录是否存在；
- 目标目录中的版本是否匹配；
- `publish.xml` 是否包含匹配项；
- 综合状态：`not_installed | installed | partial | payload_invalid | unsupported`。

目录已安装但 XML 不匹配，或者 XML 存在但目录缺失，都显示为 `partial`，允许用户重新安装修复。

## 8. 安全边界

- 不接收前端传入的安装路径、删除路径或可执行命令；
- 对名称、版本和目录名使用严格字符白名单；
- 删除前 canonicalize 父目录，并验证目标是 `jsaddons` 的直接子目录；
- 拒绝压缩包绝对路径、`..`、符号链接和多余顶层目录；
- 不使用 `sh -c`、通配符或拼接 shell 字符串；
- 文件替换和 XML 写入采用同目录暂存 + rename；
- 安装/卸载全程串行，同一时刻只允许一个变更操作；
- UI 仅加载随包静态资源，CSP 禁止远程脚本；
- Tauri capability 只授予主窗口必要的 core 权限；若不用官方 shell/fs 插件，则不开放其权限。

## 9. 错误模型与日志

错误码建议稳定化，UI 文案可本地化：

- `WPS_NOT_FOUND`
- `PAYLOAD_MISSING`
- `PAYLOAD_HASH_MISMATCH`
- `ARCHIVE_INVALID`
- `ARCHIVE_ROOT_MISMATCH`
- `TARGET_NOT_WRITABLE`
- `PATH_SAFETY_VIOLATION`
- `INSTALL_COMMIT_FAILED`
- `ROLLBACK_FAILED`
- `WPS_STOP_FAILED`
- `WPS_LAUNCH_FAILED`
- `OPERATION_BUSY`

默认日志只记录阶段、错误码和经过脱敏的相对路径，不记录用户主目录全路径。UI 提供“复制诊断信息”，不自动上传数据。

## 10. 构建与发布

第一版分别构建 macOS arm64 和 x86_64；确认所有 Rust 依赖均支持两种架构后，再考虑 universal binary。交付至少包含 `.dmg`，签名和 notarization 在正式分发前完成。

测试分三层：

- 单元测试：路径防护、清单、XML、状态判定；
- 集成测试：临时 HOME + 假 WPS 目录，覆盖安装、覆盖、回滚、卸载和幂等；
- macOS 手工验收：Intel/Apple Silicon 各一次，真实 WPS 安装、重启和 Ribbon 展示。

