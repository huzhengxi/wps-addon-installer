# WPS 插件管理器（WPS Add-on Manager）

> 面向 **WPS Office 表格（ET）加载项** 的跨平台桌面插件管理器：从可信控件源发现、校验、安装与卸载插件，并提供 WPS 目录权限恢复和应用更新。

**关键词：** WPS 插件管理器、WPS 加载项安装器、WPS JS 加载项、WPS ET 插件、WPS 表格插件、WPS Office add-on manager、WPS Office plugin installer、WPS 插件源、WPS 插件卸载、日期选择器。

## 为什么使用它

WPS JS 加载项通常需要手动解压到 `jsaddons` 目录并修改 `publish.xml`。本项目将这个流程集中到一个 React + Tauri 桌面应用中：

- 从 HTTPS 控件源读取插件目录，支持默认源和自定义源；
- 从版本化下载地址获取插件包，校验声明大小与 SHA-256 后才安装；
- 扫描 WPS 已安装插件，并可选择一个或多个插件卸载；
- 仅删除所选插件目录和对应的 `publish.xml` 配置，拒绝符号链接和越界路径；
- 检查 WPS 安装状态与加载项目录权限，拒绝授权后可打开系统设置并重新检测；
- 自动适配系统深色/浅色模式，并在启动时静默检查安装器更新。

当前首版支持 `type: "et"` 的 WPS 表格加载项，目标平台为 macOS 和 Windows。

## 界面模块

| 模块 | 能做什么 |
| --- | --- |
| 插件 | 查看已安装与可安装插件，搜索、安装、选择并卸载插件 |
| 控件源 | 添加、测试、启用或停用 HTTPS 插件目录源 |
| 权限 | 查看 WPS、安装路径与加载项目录的访问状态；恢复被拒绝的权限 |
| 帮助 | 查看操作手册、故障排查与诊断入口 |

当权限校验失败时，左侧“权限”导航会显示红色角标；手动检查应用更新时会展示加载状态。

## 控件源格式

控件源是一个静态 JSON 文件，而非文件夹或脚本 URL。安装器只接受 `https://` 索引和下载链接。最小示例：

```json
{
  "schemaVersion": 1,
  "source": { "id": "team", "name": "团队插件源" },
  "addons": [{
    "id": "date-picker",
    "name": "日期选择器",
    "type": "et",
    "version": "1.0.2",
    "description": "在 WPS 表格中选择并填写日期。",
    "platforms": ["macos", "windows"],
    "downloadUrl": "https://example.com/releases/date-picker-1.0.2.7z",
    "sha256": "64 位十六进制 SHA-256",
    "size": 123456
  }]
}
```

推荐使用 **GitHub Pages 托管索引**、**GitHub Releases 托管版本化 `.7z` 插件包**。不要使用 `latest/download`：它会变化，无法保证版本与 SHA-256 的对应关系。

完整的日期选择器打包、上传和真机测试流程见 [自定义控件源手册](docs/user-guide/custom-sources.md)。

## 使用应用

1. 启动应用后，先查看“权限”。如果有红色角标，按页面引导完成系统授权并点击“重新检测”。
2. 在“控件源”测试并启用默认源或自定义源。
3. 在“插件”页选择插件并安装。安装器会重新读取源、下载插件包、校验 SHA-256、部署文件，再尝试重启 WPS。
4. 卸载时勾选已安装插件并确认；其他插件不会被删除。

详细说明：

- [快速开始](docs/user-guide/quick-start.md)
- [安装、查看与卸载插件](docs/user-guide/manage-addons.md)
- [添加与发布自定义控件源](docs/user-guide/custom-sources.md)
- [macOS / Windows 权限恢复](docs/user-guide/permissions.md)
- [常见问题](docs/user-guide/troubleshooting.md)

## 开发

### 环境

- Node.js `20.19+` 或 `22.12+`
- Rust 工具链（项目使用 Tauri v2）
- macOS 或 Windows；Linux 可运行前端但不支持 WPS 安装操作

### 本地启动

```bash
git clone https://github.com/huzhengxi/wps-addon-manager.git
cd wps-addon-manager
npm install
npm run tauri dev
```

### 验证与打包

```bash
npm run build
cd src-tauri && cargo check
```

```bash
npm run tauri -- build
```

分别打包目标平台：

```bash
npm run package:macos
npm run package:windows
```

安装器使用 Tauri Updater 检查自身更新；更新安装器不会静默更新已安装插件。

## 安全原则

- 仅允许 HTTPS 控件源与插件下载链接；
- 索引条目必须包含文件大小和 SHA-256；
- 下载后校验大小与 SHA-256，失败不安装；
- 解压包必须有唯一、安全的顶层目录，且不允许符号链接；
- 删除操作仅限 WPS `jsaddons` 目录内已验证的直接子目录；
- 控件源损坏时隔离为提示，不阻塞其他已启用源。

## 项目结构

```text
src/                 React + Tailwind CSS 界面
src-tauri/           Tauri / Rust 命令、控件源、安装与权限逻辑
docs/user-guide/     面向终端用户的手册
docs/ui-design-v2.md 信息架构、交互与控件源契约
```

## 相关文档

- [UI 与控件源设计](docs/ui-design-v2.md)
- [用户手册目录](docs/user-guide/index.md)

## 许可证与反馈

当前仓库尚未声明开源许可证。提交 issue 前，请不要粘贴用户目录、控件源私有地址、令牌或其他敏感信息。
