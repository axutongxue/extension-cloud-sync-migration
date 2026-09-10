/**
 * background service worker
 * - 点击工具栏图标打开侧边栏
 * - 监听扩展安装/卸载，自动备份开关开启时上传到 WebDAV（默认关闭）
 */

import {
  CONFIG_KEY, AUTO_FILE,
  normalizeConfig, ensureFolder, uploadText,
  toPlugin, buildBackupDocument
} from './lib/webdav-core.js';

const DEBOUNCE_MS = 3000;

chrome.action.onClicked.addListener(async (tab) => {
  if (tab && tab.windowId) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    await chrome.sidePanel.setOptions({ enabled: true });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({ enabled: true });
});

/* ---------------- 自动备份 ---------------- */

let timer = null;

function scheduleAutoBackup() {
  clearTimeout(timer);
  timer = setTimeout(autoBackup, DEBOUNCE_MS);
}

async function getAutoBackupConfig() {
  try {
    const result = await chrome.storage.local.get(CONFIG_KEY);
    const cfg = normalizeConfig(result ? result[CONFIG_KEY] : null);
    // 自动备份默认关闭：需用户在面板中显式开启（避免新浏览器空状态覆盖云端）
    return (cfg && cfg.autoBackup) ? cfg : null;
  } catch (e) {
    return null;
  }
}

async function autoBackup() {
  const cfg = await getAutoBackupConfig();
  if (!cfg) return;
  try {
    const all = await chrome.management.getAll();
    const plugins = all
      .filter((e) => e.type === 'extension' && e.id !== chrome.runtime.id)
      .map((info) => toPlugin(info, {})); // SW 无 DOM，自动备份不含图标
    const doc = buildBackupDocument(plugins, chrome.runtime.getManifest().version);
    if (!(await ensureFolder(cfg))) return;
    await uploadText(cfg, AUTO_FILE, JSON.stringify(doc, null, 2));
    console.log('[cloud-sync] auto backup ok:', plugins.length, 'extensions');
  } catch (e) {
    console.error('[cloud-sync] auto backup failed:', e);
  }
}

chrome.management.onInstalled.addListener(scheduleAutoBackup);
chrome.management.onUninstalled.addListener(scheduleAutoBackup);
