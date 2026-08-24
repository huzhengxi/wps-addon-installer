# To-do List

规则：按 P0 → P1 → P2 实施；每一项只有在验收条件全部满足后才能勾选。第一版完成线是所有 P0 项。

## P0：可安装的第一版

- [ ] **初始化 Tauri v2 工程**
  - 使用 Vanilla TypeScript + Vite 前端、Rust 后端；
  - 固定 Node/Rust/Tauri 版本并提交 lockfile；
  - `npm run tauri dev` 能在 macOS 打开单窗口应用；
  - 应用名称、bundle identifier 和图标不使用 Tauri 默认值。

- [ ] **建立资源同步与校验流程**
  - 从 `../date-picker/wps-addon-build` 和 `../date-picker/wps-addon-publish` 同步到 `src-tauri/resources/addon/`；
  - 自动生成/更新 `addon-manifest.json` 的版本、archive root、文件大小和 SHA-256；
  - 同步前先执行当前加载项构建，或明确支持 `--skip-build`；
  - 清单版本、`package.json` 版本和压缩包根目录不一致时失败；
  - 不把整个 `date-picker` 源码和 `node_modules` 打入安装器。

- [ ] **配置 Tauri bundle resources**
  - 安装后的 `.app` 内含 `date-picker.7z`、`publish.html` 和清单；
  - Release 构建中能通过 Resource 基目录找到三者；
  - 修改任一资源后，旧清单校验必须失败。

- [ ] **完成 7z 解压技术验证**
  - 优先选定进程内 Rust 解压库并记录版本；
  - 能解压当前 LZMA2 包且目录、文件名和内容一致；
  - 路径穿越、绝对路径、符号链接和多个顶层目录测试均被拒绝；
  - 若改用 sidecar，补齐双架构二进制、哈希和许可证说明。

- [ ] **实现领域模型与环境检查**
  - 实现 `inspect_environment()`；
  - 返回 `not_installed / installed / partial / payload_invalid / unsupported`；
  - WPS 未安装、加载项目录不存在、配置残留等状态均有明确 UI 文案；
  - CPU 架构和资源版本在“详情”中可见。

- [ ] **实现安全路径层**
  - 所有目标路径由后端固定规则生成，不接受 UI 路径；
  - 删除只允许 `jsaddons` 的直接子目录；
  - 空值、根目录、HOME、`..`、符号链接和前缀相似目录测试均不能通过；
  - 测试不得修改真实用户的 WPS 目录。

- [ ] **实现事务式安装**
  - 行为覆盖 `install.sh` 的解压、复制、写 XML、重启 WPS；
  - 使用清单中的 `1.0.1`，修复旧脚本硬编码 `1.0.0` 的不一致；
  - 校验关键文件后才能提交；
  - 目标目录与 `publish.xml` 采用备份、原子替换和失败回滚；
  - 重复安装结果一致，不产生额外目录；
  - WPS 重启失败返回部分成功状态，不能误报安装失败或破坏已安装文件。

- [ ] **实现卸载**
  - 删除当前格式目录及清单列出的兼容旧目录；
  - 目标不存在时返回成功，保证幂等；
  - 第一版不修改 `publish.xml`，与当前 `uninstall.sh` 一致；
  - 卸载后重启 WPS，并正确报告“卸载成功但重启失败”。

- [ ] **实现 WPS 生命周期控制**
  - 检测 `/Applications/wpsoffice.app`；
  - 不通过 `sh -c` 执行；
  - 等价实现 `pkill -f wpsoffice`、等待退出、`open -a /Applications/wpsoffice.app`；
  - 安装/卸载前明确提示未保存文档可能丢失，并要求确认；
  - WPS 未运行时不把“无需结束”当作错误。

- [ ] **实现最小 UI**
  - 展示应用标题、内置加载项版本、WPS 状态、安装状态；
  - 提供“安装/修复”“卸载”两个主操作；
  - 操作期间禁用重复点击并显示当前阶段；
  - 卸载和 WPS 重启前有确认；
  - 错误显示用户可理解的处理建议，并允许复制诊断信息；
  - 键盘操作和暗色/亮色模式可正常使用。

- [ ] **配置最小权限与 CSP**
  - capability 只绑定 `main` 窗口；
  - 不启用不需要的 shell、fs、网络和远程 URL 权限；
  - CSP 禁止远程脚本，前端不加载 CDN；
  - Release 构建不打开 DevTools。

- [ ] **测试与质量门禁**
  - Rust 单元测试覆盖清单、路径、XML、状态机和错误映射；
  - 集成测试使用临时 HOME 完成全流程，不接触真实 WPS 数据；
  - 覆盖首次安装、覆盖安装、重复安装、损坏包、无权限、提交失败、回滚和重复卸载；
  - 前端 typecheck、lint、Rust fmt、clippy、test 均进入 CI；
  - 对当前两个载荷文件核对固定 SHA-256。

- [ ] **构建与验收安装包**
  - 生成 macOS arm64 与 x86_64 `.dmg`；
  - 在干净用户账户验证离线安装，无 Node/Homebrew/7z；
  - 在真实 WPS 表格确认 Ribbon 出现“日期选择器”；
  - 验证覆盖安装及卸载后 WPS 能重新打开；
  - 记录代码签名、公证和正式分发前置条件。

## P1：第一版后的可靠性改进

- [ ] 决定卸载时是否启用 `publish.xml` 的定向清理，并补 XML 解析测试；
- [ ] 安装时从“覆盖整个 publish.xml”升级为“只更新 date-picker、保留其他加载项”；
- [ ] 增加安装前后差异预览和本地操作历史；
- [ ] 增加“仅重启 WPS”和“打开安装目录”辅助操作；
- [ ] 支持自动发现非标准 WPS 安装位置；
- [ ] 完成 Apple Developer ID 签名、notarization 和发布流水线；
- [ ] 评估 universal binary，减少用户选择架构的成本。

## P2：后续能力

- [ ] 支持 Windows 版 WPS 安装目录与进程控制；
- [ ] 支持多个 WPS 加载项及多版本切换；
- [ ] 支持可信更新源、载荷签名校验和应用自动更新；
- [ ] 支持企业离线包、静默安装参数和管理日志导出；
- [ ] 国际化与无障碍专项验收。

## 第一版 Done 定义

第一版只有在以下条件同时满足时才算完成：

1. `.dmg` 完全离线，内含两类指定资源；
2. 无 Node、Homebrew、系统 7z 时仍能安装；
3. 安装、覆盖安装和卸载可重复执行；
4. 任一失败不会删除 `jsaddons` 下无关内容；
5. 真实 WPS 能加载日期选择器；
6. Intel 与 Apple Silicon 均通过验收；
7. `TODO.md` 全部 P0 项有对应测试或验收记录。

