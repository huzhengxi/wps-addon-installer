# 架构决策记录

## 已确定

1. **第一版只支持 macOS。** 现有两个脚本和 WPS 路径均为 macOS 专用。
2. **采用 Tauri v2。** 载荷通过 `bundle.resources` 打入应用。
3. **前端使用 Vanilla TypeScript。** 当前 UI 很小，不引入额外 SPA 框架。
4. **文件与进程操作只在 Rust 中完成。** 前端不获取通用 shell/fs 权限。
5. **清单是唯一版本来源。** 当前版本为 `1.0.1`，以实际 archive root 和 `package.json` 为准。
6. **两类目录都随应用打包。** `wps-addon-publish/publish.html` 第一版只携带、不执行。
7. **第一版安装覆盖 `publish.xml`。** 这与 `install.sh` 一致；增加备份和回滚，但不擅自改变最终内容。
8. **第一版卸载不清理 `publish.xml`。** 这与当前 `uninstall.sh` 的有效代码一致。
9. **WPS 重启需要确认。** GUI 必须保护用户未保存的文档。
10. **运行时不依赖源码工程、Node.js、Homebrew 或系统 7z。**
11. **应用自动更新使用 Tauri Updater + GitHub Releases。** 更新包用 minisign 签名，公钥内置，私钥只存 GitHub Secrets；`latest.json` 由发布流水线从签名资产生成。暂不引入镜像 endpoint，避免过期清单遮蔽新版本。

## P0 技术验证后确定

1. 具体的 Rust 7z 解压 crate；如果不满足兼容性/安全性，则切换到双架构 `7za` sidecar。
2. macOS 最低系统版本，需结合 WPS 支持范围与 Tauri WebView 要求实机验证。
3. 应用正式名称、bundle identifier、图标和签名团队。

这些事项不会改变模块边界，但会影响 `Cargo.toml`、`tauri.conf.json` 和发布流水线。

## P1 产品决策

1. 安装时是否改为合并 `publish.xml`，保留其他加载项；
2. 卸载时是否启用脚本中已注释的定向 XML 清理；
3. 是否允许用户选择“完成后不重启 WPS”。

在第一版实现中不得提前改变这些行为，否则就不再是按当前脚本逻辑实现。
