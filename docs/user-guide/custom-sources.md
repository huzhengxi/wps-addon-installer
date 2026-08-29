# 添加与发布自定义控件源

控件源是一个通过 HTTPS 提供的 JSON 索引地址。它不是本地文件夹，也不是任意网页；索引只描述可下载的插件包及其校验信息。安装器只接受 HTTPS 下载地址，并会核对插件包大小和 SHA-256。校验失败的文件会被拒绝安装。

## 使用者：添加一个已有控件源

1. 打开安装器的“控件源”页，点击“添加控件源”。
2. 填写名称，例如“团队插件源”。
3. 填写发布者提供的索引 URL，例如 `https://example.github.io/wps-addon-catalog/v1/index.json`。
4. 保存后该源保持停用状态；点击“测试连接”。
5. 测试显示“连接成功，索引格式有效”并列出插件数量后，再启用该源。
6. 回到“插件”页刷新，即可查看该源提供的插件。

如果测试失败，请检查 URL 是否以 `https://` 开头、能否在浏览器中打开，以及发布者是否保留了索引中引用的版本化插件包。

## 发布者示例：从 `date-picker` 生成控件源

本项目以 `/Users/jason/src/liqiong/date-picker` 的日期选择器为完整样例。项目已包含 `scripts/package-catalog.sh`，并在 `package.json` 中提供 `package:catalog` 命令。

### 1. 确定版本

先在 `/Users/jason/src/liqiong/date-picker/package.json` 中确认：

```json
{ "name": "date-picker", "addonType": "et", "version": "1.0.1" }
```

每次发布新版本都必须递增 `version`。安装器会以 `date-picker_1.0.1` 作为 WPS 插件目录名，因此 `name`、`version` 不得使用空格、斜杠或中文。

### 2. 安装打包依赖

首次在项目目录执行：

```bash
cd /Users/jason/src/liqiong/date-picker
npm install
```

脚本会调用现有的 `wpsjs` 离线构建能力，并需要 `7z`、`7zz`，或项目依赖提供的 `7za` 来检查压缩包内容。macOS 可执行 `brew install sevenzip`；Windows 可安装 7-Zip 并将命令行工具加入 `PATH`。

### 3. 生成可发布目录

先计划固定 Release tag，例如 `date-picker-v1.0.1`，最终下载 URL 通常为：

```text
https://github.com/OWNER/wps-addon-catalog/releases/download/date-picker-v1.0.1/date-picker-1.0.1.7z
```

将 `OWNER` 改为实际组织或用户名。可显式指定发布版本：

```bash
cd /Users/jason/src/liqiong/date-picker
DOWNLOAD_URL="https://github.com/OWNER/wps-addon-catalog/releases/download/date-picker-v1.0.1/date-picker-1.0.1.7z" \
npm run package:catalog -- 1.0.1
```

不传版本参数时，脚本会自动将 `package.json` 中版本号的最后一段加一，例如 `1.0.1` 变为 `1.0.2`：

```bash
DOWNLOAD_URL="https://github.com/OWNER/wps-addon-catalog/releases/download/date-picker-v1.0.2/date-picker-1.0.2.7z" \
npm run package:catalog
```

脚本会把最终版本写回 `package.json`，并构建 WPS 离线 `.7z` 包；解压验证 `date-picker_1.0.1` 与 `manifest.xml`、`index.html`、`main.js`；复制版本化文件到 `catalog/releases/`；计算 SHA-256、文件大小，并生成 `catalog/v1/index.json`。

不要手工修改生成的 `sha256` 或 `size`。只要更改压缩包，就必须重新运行脚本。

### 4. 上传到 GitHub Releases 与 GitHub Pages

推荐“GitHub Pages 放索引 + GitHub Releases 放插件包”。

1. 新建或使用公开仓库 `wps-addon-catalog`。
2. 创建 tag 和 Release：`date-picker-v1.0.1`。
3. 上传 `catalog/releases/date-picker-1.0.1.7z` 作为 Release 附件。
4. 将 `catalog/v1/index.json` 提交到 Pages 仓库的 `v1/index.json` 路径；在 Settings → Pages 启用静态站点发布。
5. 最终索引地址应形如：`https://OWNER.github.io/wps-addon-catalog/v1/index.json`。
6. 在浏览器中打开索引 URL，并打开 JSON 内的 `downloadUrl`，确认前者显示 JSON、后者下载 `.7z`。

不要使用 `latest/download`，因为它会随 Release 变化，无法保证索引中的版本与校验值一致。

### 5. 在安装器中测试

1. 打开 WPS 插件管理器 → “控件源” → “添加控件源”。
2. 填“日期选择器测试源”，URL 填 GitHub Pages 的 `v1/index.json`。
3. 保存后点击“测试连接”。预期看到“连接成功”和 `1` 个插件。
4. 启用此源，进入“插件”页；应出现“日期选择器”和发布版本号。
5. 点击“安装”。安装器会重新读取索引、下载 Release 附件、核对 SHA-256、解压并写入 WPS 加载项目录。
6. 打开 WPS 表格，确认 Ribbon 中显示“日期选择器”。

第 3 步失败时，检查 Pages 是否已部署、索引是否为合法 JSON，以及 `schemaVersion` 是否为 `1`。第 5 步提示校验不一致时，重新运行打包脚本并重新上传插件包与索引；不要绕过校验。

## 索引格式参考

脚本会生成以下结构，通常无需手写：

```json
{
  "schemaVersion": 1,
  "source": { "id": "date-picker-catalog", "name": "日期选择器控件源" },
  "addons": [{
    "id": "date-picker", "name": "日期选择器", "type": "et", "version": "1.0.1",
    "downloadUrl": "https://…/date-picker-1.0.1.7z",
    "sha256": "64 位十六进制 SHA-256", "size": 123456
  }]
}
```

同一个版本一经发布，不要替换其 `.7z` 文件；需要修复时，递增版本号并发布新 tag、新附件和新索引。
