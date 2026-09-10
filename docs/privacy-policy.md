# 隐私政策 / Privacy Policy

> 生效日期：2026-09-10 / Effective date: 2026-09-10

本扩展「扩展云同步与迁移助手 / Extension Cloud Sync & Migration」由作者个人开发并提供。
本政策说明扩展收集、使用与共享哪些数据。 / This policy explains what data the extension collects, uses and shares.

---

## 中文版

### 1. 我们收集什么

开发者**不收集**任何个人数据。扩展本身仅在你所在设备上读取以下信息以完成备份/恢复功能：

- 当前浏览器中**已安装的扩展列表**（名称、版本、图标、ID、启停状态、来源商店）；
- 你在「云同步」面板中**自行填写**的 WebDAV 配置（服务器地址、用户名、密码）；
- 你通过「导入」或云同步加载的备份文件内容。

### 2. 数据存储位置

- **本机存储**：WebDAV 配置、导入的备份数据保存在浏览器的 `chrome.storage.local` 中，仅本机浏览器可读，不会上传到开发者服务器。
- **云端**：只有在以下情况，扩展才会把「扩展列表数据」发送到**你自行配置的 WebDAV 服务器**（任意 WebDAV 服务，例如坚果云、Nextcloud、自建服务器）：
  - 你手动点击「备份到云端」；
  - 你开启了「自动备份」并发生了扩展安装/卸载事件。

### 3. 第三方

扩展不接入任何开发者运营的服务器或第三方统计/广告 SDK。唯一的网络通信对象是**用户自己填写的 WebDAV 服务器**，扩展不对该服务器负控制责任。

### 4. 共享与出售

开发者不会出售、出租或与第三方共享上述任何数据。

### 5. 儿童隐私

本扩展面向一般用户，不面向儿童收集数据。

### 6. 政策变更

若政策有重大变更，将在本页面更新并修订生效日期。

### 7. 联系我们

如有隐私相关问题，请联系：`axutongxue@qq.com`。

---

## English

### 1. What we collect

The developer does **not** collect any personal data. On your device, the extension reads the following information to provide backup/restore features:

- The **list of installed extensions** in your browser (name, version, icon, ID, enabled state, install source);
- The **WebDAV configuration you enter yourself** in the Cloud Sync panel (server URL, username, password);
- The content of backup files you load via Import or cloud sync.

### 2. Where data is stored

- **Locally**: WebDAV configuration and imported backup data are kept in the browser's `chrome.storage.local`, readable only on your device, and never uploaded to the developer's servers.
- **Cloud**: Only in these cases is extension-list data sent to the **WebDAV server you configure yourself** (any WebDAV service, e.g. Jianguoyun, Nextcloud, self-hosted):
  - You click "Backup to cloud" manually;
  - You enabled "Auto backup" and an extension install/uninstall event occurred.

### 3. Third parties

The extension does not integrate any developer-operated server, analytics or advertising SDK. The only network peer is the **WebDAV server you provide**; the extension has no control over that server.

### 4. Sharing & selling

The developer does not sell, rent or share the above data with third parties.

### 5. Children's privacy

The extension is intended for general audiences and does not collect data from children.

### 6. Changes

If this policy changes materially, it will be updated on this page with a revised effective date.

### 7. Contact

For privacy questions, contact: `axutongxue@qq.com`.