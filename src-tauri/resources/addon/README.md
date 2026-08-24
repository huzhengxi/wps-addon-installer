# Bundled addon resources

此目录是 Tauri 安装包的离线载荷边界：

- `addon-manifest.json` 是运行时唯一元数据来源；
- `wps-addon-build/date-picker.7z` 是安装输入；
- `wps-addon-publish/publish.html` 按产品要求随包携带，但第一版安装逻辑不使用它。

实现阶段应提供资源同步脚本，不要继续手工维护这些副本。同步完成后必须同时验证压缩包根目录、大小和 SHA-256。

