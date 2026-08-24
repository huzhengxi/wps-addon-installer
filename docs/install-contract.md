# 安装与卸载行为契约

本文档区分“现有脚本的实际行为”和“Tauri 第一版应实现的行为”。实现者不得从脚本中执行或复制任意 shell 字符串，而应在 Rust 中逐项实现同等语义。

## 已核对的输入

- `date-picker/package.json`：版本 `1.0.1`；
- `wps-addon-build/date-picker.7z`：唯一顶层目录 `date-picker_1.0.1`；
- `install.sh` / `uninstall.sh`：版本仍写死为 `1.0.0`；
- `wps-addon-publish/publish.html`：需随应用携带，但脚本未使用。

因此旧 `install.sh` 在当前产物上会在解压校验阶段失败。Tauri 第一版应实现脚本的**意图和步骤**，版本取资源清单中的 `1.0.1`。

## 固定路径与名称

| 项目 | 值 |
|---|---|
| WPS bundle id | `com.kingsoft.wpsoffice.mac` |
| WPS 应用 | `/Applications/wpsoffice.app` |
| 加载项目录 | `$HOME/Library/Containers/com.kingsoft.wpsoffice.mac/Data/.kingsoft/wps/jsaddons` |
| 加载项名称 | `date-picker` |
| 类型 | `et` |
| 当前版本 | `1.0.1` |
| 当前目录 | `date-picker_1.0.1` |
| 旧格式目录 | `date-picker_v1.0.1` |
| 历史脚本目录 | `date-picker_1.0.0`、`date-picker_v1.0.0` |

## install.sh 映射

| 脚本行为 | Tauri 第一版行为 | 验收点 |
|---|---|---|
| 检查 `wps-addon-build/date-picker.7z` | 从 Resource 目录读取并校验 SHA-256 | 缺失/篡改时拒绝安装 |
| 根据 CPU 找 `7za`，否则找系统 `7z` | 首选 Rust 进程内解压；必要时双架构 sidecar | 最终用户无需 Node/Homebrew |
| 解压到临时目录 | 使用系统安全临时目录和自动清理守卫 | 成败均无遗留临时目录 |
| 检查版本目录 | 严格验证清单声明的唯一根目录及关键文件 | 根目录不匹配时报专用错误 |
| 创建 `jsaddons` | 递归创建固定目录 | 不接受 UI 自定义路径 |
| 删除当前及旧格式目录 | 精确删除清单允许的目录，先备份以便回滚 | 不触碰其他加载项 |
| `cp -r` 到 `jsaddons` | 同文件系统暂存后 rename 提交 | 中断时不会留下半目录 |
| 覆盖写 `publish.xml` | 生成等价 XML，临时文件落盘后 rename | 内容与版本一致 |
| 清理临时目录 | RAII 自动清理 | 异常路径也清理 |
| `pkill`、等待 2 秒、`open` WPS | Rust 子进程调用，等待退出并重新打开 | 不使用 shell 拼接 |

安装生成的第一版 XML：

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<jsplugins>
  <jsplugin name="date-picker" type="et" url="date-picker_1.0.1" version="1.0.1" enable="enable_dev" install="null" customDomain=""/>
</jsplugins>
```

注意：这会覆盖已有 `publish.xml`，可能移除其他加载项注册。第一版为了严格遵循 `install.sh` 保留这一语义，但必须先备份并支持失败回滚；P1 再改成定向合并。

## uninstall.sh 映射

| 脚本行为 | Tauri 第一版行为 | 验收点 |
|---|---|---|
| 删除当前格式目录 | 精确删除 `date-picker_1.0.1` | 不存在也成功 |
| 删除旧格式目录 | 精确删除 `date-picker_v1.0.1`，并兼容清理清单中列出的 1.0.0 历史目录 | 不使用通配符 |
| `publish.xml` 清理被注释 | 第一版不修改 `publish.xml` | 与现有脚本一致 |
| 重启 WPS | 安全结束并重新打开 | 重启失败与卸载结果分开报告 |

## WPS 重启交互

现有脚本会直接结束 WPS，可能导致未保存内容丢失。GUI 必须在调用安装或卸载前明确提示并要求用户确认；确认后才执行与脚本等价的重启步骤。这个确认不改变脚本的最终效果，只补齐桌面应用必要的用户保护。

## 幂等与部分成功

- 安装两次：最终只有一个当前目录，XML 一致；
- 卸载两次：第二次仍成功；
- 文件安装成功但 WPS 打开失败：返回 `installed + WPS_LAUNCH_FAILED`，不回滚文件；
- 文件删除成功但 WPS 打开失败：返回 `not_installed + WPS_LAUNCH_FAILED`；
- 提交 XML 失败：恢复原目录和原 `publish.xml`。

