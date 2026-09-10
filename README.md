# 扩展云同步与迁移助手

> Extension Cloud Sync & Migration

备份、恢复并迁移您的 Chrome 扩展列表：一键导出 JSON、导入恢复，支持任意 WebDAV 服务器云备份，扩展安装/卸载后自动备份。

**Back up, restore and migrate your Chrome extensions: one-click JSON export/import, WebDAV cloud sync, and auto backup when extensions are installed or uninstalled.**

## 功能特性 / Features

- 🗂️ **扩展列表管理**：搜索、按状态/来源筛选、启停切换 / *Extension list with search, filters (status & source) and enable/disable*
- 📤 **本地导出**：将选中的扩展（含图标）导出为 JSON 备份文件 / *Export selected extensions (with icons) to a JSON backup file*
- 📥 **本地导入与恢复**：导入备份文件，对比本机缺失项，逐个打开商店页恢复安装 / *Import a backup, diff missing items and jump to the store page to reinstall*
- ☁️ **WebDAV 云同步**：支持任意 WebDAV 服务器（如坚果云、Nextcloud、自建）手动备份与恢复最新备份 / *WebDAV cloud sync with any WebDAV server (e.g. Jianguoyun, Nextcloud, self-hosted): manual backup & restore the latest*
- ⚙️ **自动备份**：开启后，扩展安装/卸载时自动上传最新列表到云端（默认关闭） / *Auto backup on install/uninstall (off by default)*
- 🌐 **多语言**：中文 / English

## 安装 / Install

### Chrome 应用商店
发布后从 Chrome Web Store 搜索 **扩展云同步与迁移助手** 安装。

### 开发者模式加载（用于开发调试）
1. 打开 `chrome://extensions`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本仓库根目录
4. 点击工具栏图标打开侧边栏

## 使用 / Usage

1. 点击工具栏图标打开侧边栏。
2. **本地备份**：选中要备份的扩展，点击「导出」，保存 `chrome-plugins.json`。
3. **恢复**：点击「导入」选择备份文件，在恢复列表里查看缺失的扩展，点击「开始恢复」逐跳转商店安装。
4. **云同步**：打开「云同步」→ 填写 WebDAV 服务器地址、用户名和密码 → 保存并测试连接 → 即可「备份到云端」/「恢复最新备份」。
   - 扩展支持任意 WebDAV 服务（如坚果云、Nextcloud、自建服务器）；部分服务需要先在账户设置中获取**应用密码**。
5. **自动备份**（可选）：在云同步面板中勾选「安装/卸载后自动备份到云端」。

## 备份文件格式 / Backup format

JSON（`schemaVersion: 1`），与旧版同类工具导出的 `chrome-plugins.json` 兼容。

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-09-10T02:00:00.000Z",
  "source": { "browser": "Chrome", "extensionVersion": "1.1.0" },
  "extensions": [
    { "id": "abcdefghijklmnop...", "name": "...", "version": "1.0", "icons": { "48": "data:image/png;base64,..." }, "enabled": true, "source": "store", "storeRestorable": true }
  ]
}
```

## 权限说明 / Permissions

| 权限 | 用途 / Purpose |
| --- | --- |
| `management` | 读取已安装扩展列表，用于导出、备份与恢复检测 |
| `storage` | 保存 WebDAV 配置、导入的备份数据（仅本地存储） |
| `sidePanel` | 在浏览器侧边栏展示扩展列表与操作界面 |
| `https://*/*` | 仅用于向**您自己配置**的 WebDAV 服务器发起备份请求 |

您的 WebDAV 账号密码仅保存在本机 `chrome.storage.local`，只在您主动备份时发送到您填写的服务器；开发者不采集任何数据。

## 隐私 / Privacy

详见 [Privacy Policy](./docs/privacy-policy.md)。

## 开发 / Development

纯原生 JavaScript（MV3），无构建步骤、无第三方依赖：

```
manifest.json
background.js        - Service Worker：侧边栏开关、安装/卸载自动备份
sidepanel.html/css   - 侧边栏界面
sidepanel.js         - 侧边栏主逻辑（列表/导出/导入/云同步）
lib/webdav-core.js   - WebDAV 客户端与备份文档构建（页面与 SW 共用）
icons/               - 扩展图标
_locales/            - 中英文本地化
```

## 谢谢 / Thanks

如果这个工具帮到了你，欢迎点个 Star，也可以请我喝杯咖啡 ☕

<img src="donate-qr.png" width="180" alt="微信赞赏码" />

## 许可证 / License

[MIT](./LICENSE)