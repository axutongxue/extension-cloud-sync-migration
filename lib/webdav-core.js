/**
 * WebDAV 客户端核心 + 备份文档构建（无 DOM 依赖）
 * background service worker 与 sidepanel 页面共用。
 * 备份文档格式与「扩展应用同步工具」chrome-plugins.json（schemaVersion 1）保持兼容。
 */

export const CONFIG_KEY = 'webdavConfig';
export const FOLDER = 'extensions-syncer';
export const AUTO_FILE = 'auto_backup.json';
export const MAX_IMPORT_BYTES = 5242880; // 5MB，与原扩展导入上限一致

/* ---------------- 配置 ---------------- */

// 兼容对象与 JSON 字符串两种存储形式
export function normalizeConfig(saved) {
  if (typeof saved === 'string') {
    try { saved = JSON.parse(saved); } catch (e) { saved = null; }
  }
  if (saved && typeof saved === 'object' && saved.server && saved.username && saved.password) {
    return {
      server: saved.server,
      username: saved.username,
      password: saved.password,
      autoBackup: !!saved.autoBackup
    };
  }
  return null;
}

export async function loadConfig() {
  const result = await chrome.storage.local.get(CONFIG_KEY);
  return normalizeConfig(result ? result[CONFIG_KEY] : null);
}

export async function saveConfig(cfg) {
  const item = {};
  item[CONFIG_KEY] = cfg;
  await chrome.storage.local.set(item);
}

/* ---------------- WebDAV 基础请求 ---------------- */

function authHeader(cfg) {
  return 'Basic ' + btoa(cfg.username + ':' + cfg.password);
}

function baseUrl(cfg) {
  return cfg.server.replace(/\/+$/, '');
}

export function folderUrl(cfg) {
  return baseUrl(cfg) + '/' + FOLDER;
}

function fileUrl(cfg, name) {
  return folderUrl(cfg) + '/' + encodeURIComponent(name);
}

export async function testConnection(cfg) {
  try {
    const res = await fetch(baseUrl(cfg) + '/', {
      method: 'PROPFIND',
      headers: { 'Authorization': authHeader(cfg), 'Depth': '0' },
      body: '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>'
    });
    return res.ok || res.status === 207;
  } catch (e) {
    return false;
  }
}

export async function ensureFolder(cfg) {
  const res = await fetch(folderUrl(cfg) + '/', {
    method: 'MKCOL',
    headers: { 'Authorization': authHeader(cfg) }
  });
  // 200/201 = 创建成功，405 = 已存在
  return res.ok || res.status === 201 || res.status === 405;
}

// 用正则解析 PROPFIND 响应（service worker 里没有 DOMParser）
function parsePropfindNames(text) {
  const names = [];
  const responseRe = /<(?:[A-Za-z0-9]+:)?response\b[\s\S]*?<\/(?:[A-Za-z0-9]+:)?response>/g;
  const strip = (s) => s.replace(/^<(?:[A-Za-z0-9]+:)?/, '<').replace(/<\/(?:[A-Za-z0-9]+:)/, '</');
  let m;
  while ((m = responseRe.exec(text)) !== null) {
    const block = strip(m[0]);
    const href = /<href>([\s\S]*?)<\/href>/.exec(block);
    if (!href) continue;
    const decoded = decodeURIComponent(href[1].trim());
    const last = decoded.split('/').filter(Boolean).pop() || '';
    if (/\.json$/i.test(last)) names.push(last);
  }
  return names;
}

export async function listBackups(cfg) {
  const res = await fetch(folderUrl(cfg) + '/', {
    method: 'PROPFIND',
    headers: { 'Authorization': authHeader(cfg), 'Depth': '1' },
    body: '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/><d:getlastmodified/></d:prop></d:propfind>'
  });
  if (res.status === 404) return [];
  if (!(res.ok || res.status === 207)) {
    throw new Error('LIST_FAILED_' + res.status);
  }
  const names = parsePropfindNames(await res.text());
  // auto_backup.json 优先（实时最新状态），其余按文件名倒序（时间戳最新在前）
  names.sort((a, b) => {
    const aAuto = a === AUTO_FILE ? 1 : 0;
    const bAuto = b === AUTO_FILE ? 1 : 0;
    if (aAuto !== bAuto) return bAuto - aAuto;
    return b.localeCompare(a);
  });
  return names;
}

export async function uploadText(cfg, name, text) {
  const res = await fetch(fileUrl(cfg, name), {
    method: 'PUT',
    headers: { 'Authorization': authHeader(cfg), 'Content-Type': 'application/json' },
    body: text
  });
  if (!res.ok) throw new Error('UPLOAD_FAILED_' + res.status);
}

export async function downloadText(cfg, name) {
  const res = await fetch(fileUrl(cfg, name), {
    method: 'GET',
    headers: { 'Authorization': authHeader(cfg) }
  });
  if (!res.ok) throw new Error('DOWNLOAD_FAILED_' + res.status);
  return await res.text();
}

/* ---------------- 数据模型（与原扩展 schemaVersion 1 兼容） ---------------- */

export function isValidExtensionId(id) {
  return /^[a-p]{32}$/.test(id);
}

// 从扩展的 updateUrl 推断来源商店：
// Chrome Web Store -> 'cws'；Edge 商店 -> 'edge'；解包/未知 -> ''
export function storeHostOf(updateUrl) {
  if (typeof updateUrl !== 'string' || !updateUrl) return '';
  if (/microsoftedge|edge\.microsoft\.com/i.test(updateUrl)) return 'edge';
  if (/google/i.test(updateUrl)) return 'cws';
  return '';
}

export function classifyInstallSource(installType) {
  switch (installType) {
    case 'normal': return 'store';
    case 'development': return 'development';
    case 'admin': return 'policy';
    case 'sideload': return 'sideload';
    default: return 'other';
  }
}

// icons 参数：手动备份传入转换后的便携图标 { '48': dataUri }；自动备份（SW 无 DOM）传 {}；
// 不传（undefined）时从 info.icons 构建原始 URL map（列表显示用）
export function toPlugin(info, icons) {
  const installType = info.installType != null ? info.installType : 'normal';
  const source = classifyInstallSource(installType);
  const iconMap = icons !== undefined
    ? icons
    : Object.fromEntries((info.icons != null ? info.icons : []).map((i) => [String(i.size), i.url]));
  return {
    id: info.id,
    name: info.name,
    version: info.version,
    description: info.description,
    icons: iconMap,
    enabled: info.enabled != null ? info.enabled : true,
    installType: installType,
    source: source,
    manageable: info.mayDisable != null ? info.mayDisable : true,
    storeRestorable: source === 'store' && isValidExtensionId(info.id),
    storeHost: storeHostOf(info.updateUrl)
  };
}

export function getStoreUrl(id) {
  if (!isValidExtensionId(id)) return null;
  return 'https://chromewebstore.google.com/detail/' + id;
}

export function buildBackupDocument(plugins, extensionVersion) {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    source: { browser: 'Chrome', extensionVersion: extensionVersion },
    extensions: plugins
  };
}

// 导入文本校验（接受 schemaVersion 1 对象或旧版纯数组），返回规整后的文档
export function parseImportText(text) {
  const err = (code) => { const e = new Error(code); e.code = code; return e; };
  if (!text || !text.trim()) throw err('EMPTY_FILE');
  if (new Blob([text]).size > MAX_IMPORT_BYTES) throw err('FILE_TOO_LARGE');
  let data;
  try { data = JSON.parse(text); } catch (e) { throw err('INVALID_JSON'); }
  const isArray = Array.isArray(data);
  if (!isArray && (typeof data !== 'object' || data === null)) throw err('INVALID_ROOT');
  if (!isArray && typeof data.schemaVersion !== 'number') throw err('INVALID_ROOT');
  if (!isArray && data.schemaVersion !== 1) throw err('UNSUPPORTED_VERSION');
  const raw = isArray ? data : data.extensions;
  if (!Array.isArray(raw)) throw err('INVALID_ROOT');

  const seen = new Map();
  for (const it of raw) {
    if (typeof it !== 'object' || it === null) continue;
    const id = typeof it.id === 'string' ? it.id.slice(0, 64) : '';
    const name = typeof it.name === 'string' ? it.name.trim().slice(0, 500) : '';
    if (!isValidExtensionId(id) || !name) continue;
    if (seen.has(id)) continue;
    seen.set(id, sanitizePlugin(it, id, name));
  }
  if (seen.size === 0) throw err('NO_VALID_ENTRY');

  return {
    schemaVersion: 1,
    exportedAt: (!isArray && typeof data.exportedAt === 'string') ? data.exportedAt : new Date().toISOString(),
    source: (!isArray && typeof data.source === 'object' && data.source !== null) ? data.source : {},
    extensions: [...seen.values()]
  };
}

function sanitizePlugin(it, id, name) {
  const installType = typeof it.installType === 'string' && ['normal', 'development', 'admin', 'sideload', 'other'].includes(it.installType)
    ? it.installType : 'other';
  const source = typeof it.source === 'string' && ['store', 'development', 'policy', 'sideload', 'other'].includes(it.source)
    ? it.source : classifyInstallSource(installType);
  return {
    id: id,
    name: name,
    version: typeof it.version === 'string' ? it.version.slice(0, 100) : '',
    description: typeof it.description === 'string' ? it.description.slice(0, 10000) : '',
    icons: sanitizeIcons(it.icons),
    enabled: typeof it.enabled === 'boolean' ? it.enabled : true,
    installType: installType,
    source: source,
    manageable: typeof it.manageable === 'boolean' ? it.manageable : true,
    storeRestorable: source === 'store' && (typeof it.storeRestorable === 'boolean' ? it.storeRestorable : true),
    storeHost: typeof it.storeHost === 'string' && ['cws', 'edge'].includes(it.storeHost) ? it.storeHost : ''
  };
}

// 图标仅接受 data:image 或 https 链接（与原扩展导入过滤规则一致）
function sanitizeIcons(icons) {
  if (typeof icons !== 'object' || icons === null) return {};
  const out = {};
  let count = 0;
  for (const [size, url] of Object.entries(icons)) {
    if (count >= 4) break;
    if (!/^\d{1,4}$/.test(size)) continue;
    if (typeof url !== 'string') continue;
    if ((url.startsWith('data:image/') || url.startsWith('https://')) && url.length <= 250000) {
      out[size] = url;
      count++;
    }
  }
  return out;
}
