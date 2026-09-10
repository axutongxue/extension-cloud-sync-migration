/**
 * sidepanel 主逻辑
 * - 扩展列表（搜索/启停/选择）
 * - 导出选中 / 导入本地 JSON
 * - 恢复流程（对比缺失，逐个打开商店页）
 * - WebDAV 云同步（配置 / 手动备份 / 恢复最新 / 自动备份开关）
 */

import {
  CONFIG_KEY,
  loadConfig, saveConfig,
  testConnection, ensureFolder, listBackups, uploadText, downloadText,
  toPlugin, buildBackupDocument, parseImportText, getStoreUrl
} from './lib/webdav-core.js';

/* ---------------- i18n ---------------- */

const LOCALES = {
  zh: {
    appName: '扩展云同步与迁移助手',
    searchPlaceholder: '搜索扩展…',
    filters: '筛选', fStatus: '状态', fSource: '来源',
    fAll: '全部', fEnabled: '已启用', fDisabled: '已停用',
    srcStore: '商店', srcDev: '开发版', srcPolicy: '企业策略', srcSideload: '侧载', srcOther: '其他',
    clearFilters: '清除筛选',
    hostChrome: 'Chrome', hostEdge: 'Edge',
    hostChromeTip: '从 Chrome 应用商店安装', hostEdgeTip: '从 Edge 加载项安装',
    migrateToChrome: '⇗ Chrome', migrateToChromeTip: '在 Chrome 应用商店搜索同款，便于迁移到 Chrome 版',
    import: '导入', export: '导出', exportCount: (n) => `导出(${n})`,
    cloudSyncTitle: '云同步', cloudTitle: '云同步 · WebDAV',
    recoveryTitle: '恢复', discard: '放弃',
    startRecovery: '开始恢复', installNext: '安装下一个',
    restored: '已恢复', missing: '待安装', unavailable: '不可用',
    recoveryCompleteDetail: '所有可恢复扩展均已安装或处理完成',
    selectAll: '全选', noMatch: '没有匹配的扩展',
    donateTitle: '支持作者',
    serverPh: 'https://dav.example.com/dav/',
    userPh: '用户名',
    passPh: '密码（部分服务需使用应用密码）',
    saveAndTest: '保存并测试连接',
    connected: '已连接',
    backupNow: '☁️ 备份到云端', restoreLatest: '⬇️ 恢复最新备份',
    autoBackupLabel: '安装/卸载后自动备份到云端',
    autoOn: '自动备份已开启', autoOff: '自动备份已关闭',
    modify: '修改配置', clearCfg: '清除配置',
    testing: '正在测试连接...', creatingFolder: '正在创建备份文件夹...',
    cfgOk: 'WebDAV 配置成功！',
    needFields: '请填写完整的 WebDAV 配置',
    connFail: '连接失败，请检查地址与账号（部分服务需使用应用密码）',
    folderFail: '无法创建备份文件夹', cfgCleared: '配置已清除',
    backuping: '正在获取扩展列表...', uploading: (n) => `正在上传 ${n} 个扩展...`,
    backupOk: (n) => `备份成功（${n} 个扩展）`,
    backupFail: (m) => `备份失败：${m}`,
    listing: '正在获取云端备份列表...',
    noCloudBackup: '云端没有找到备份文件',
    downloading: (n) => `正在下载 ${n} ...`,
    invalidDoc: '备份文件格式无效',
    restoreConfirm: (name, n) => `恢复备份「${name}」（${n} 个扩展）？当前导入数据会被覆盖。`,
    restoreCancelled: '已取消恢复',
    importing: '正在导入...', importOk: (n) => `导入 ${n} 个扩展，请检查恢复列表`,
    importFail: (m) => `导入失败：${m}`,
    installed: '已安装', disabled: '已停用',
    errMap: {
      EMPTY_FILE: '文件为空', FILE_TOO_LARGE: '文件超过 5 MB',
      INVALID_JSON: '不是有效的 JSON', INVALID_ROOT: '备份文件格式无效',
      UNSUPPORTED_VERSION: '不支持的备份版本', NO_VALID_ENTRY: '没有有效的扩展条目',
      LIST_FAILED: '获取云端列表失败', UPLOAD_FAILED: '上传失败', DOWNLOAD_FAILED: '下载失败'
    }
  },
  en: {
    appName: 'Extension Cloud Sync & Migration',
    searchPlaceholder: 'Search extensions…',
    filters: 'Filters', fStatus: 'Status', fSource: 'Source',
    fAll: 'All', fEnabled: 'Enabled', fDisabled: 'Disabled',
    srcStore: 'Web Store', srcDev: 'Developer', srcPolicy: 'Policy', srcSideload: 'Sideloaded', srcOther: 'Other',
    clearFilters: 'Clear filters',
    hostChrome: 'Chrome', hostEdge: 'Edge',
    hostChromeTip: 'Installed from Chrome Web Store', hostEdgeTip: 'Installed from Microsoft Edge Add-ons',
    migrateToChrome: '⇗ Chrome', migrateToChromeTip: 'Search the same item on Chrome Web Store to migrate to the Chrome version',
    import: 'Import', export: 'Export', exportCount: (n) => `Export (${n})`,
    cloudSyncTitle: 'Cloud sync', cloudTitle: 'Cloud Sync · WebDAV',
    recoveryTitle: 'Recovery', discard: 'Discard',
    startRecovery: 'Start recovery', installNext: 'Install next',
    restored: 'restored', missing: 'pending', unavailable: 'unavailable',
    recoveryCompleteDetail: 'All available extensions are installed or have been handled.',
    selectAll: 'Select all', noMatch: 'No matching extensions',
    donateTitle: 'Support the author',
    serverPh: 'https://dav.example.com/dav/',
    userPh: 'Username',
    passPh: 'Password (use an app password if required)',
    saveAndTest: 'Save & test connection',
    connected: 'Connected',
    backupNow: '☁️ Backup to cloud', restoreLatest: '⬇️ Restore latest',
    autoBackupLabel: 'Auto backup on install/uninstall',
    autoOn: 'Auto backup enabled', autoOff: 'Auto backup disabled',
    modify: 'Edit', clearCfg: 'Clear',
    testing: 'Testing connection...', creatingFolder: 'Creating backup folder...',
    cfgOk: 'WebDAV configured!',
    needFields: 'Please fill in all WebDAV fields',
    connFail: 'Connection failed (some providers require an app password)',
    folderFail: 'Cannot create backup folder', cfgCleared: 'Config cleared',
    backuping: 'Collecting extensions...', uploading: (n) => `Uploading ${n} extensions...`,
    backupOk: (n) => `Backup ok (${n} extensions)`,
    backupFail: (m) => `Backup failed: ${m}`,
    listing: 'Listing cloud backups...',
    noCloudBackup: 'No backup files found in cloud',
    downloading: (n) => `Downloading ${n} ...`,
    invalidDoc: 'Invalid backup file',
    restoreConfirm: (name, n) => `Restore "${name}" (${n} extensions)? Current import data will be overwritten.`,
    restoreCancelled: 'Restore cancelled',
    importing: 'Importing...', importOk: (n) => `Imported ${n} extensions, check the recovery list`,
    importFail: (m) => `Import failed: ${m}`,
    installed: 'installed', disabled: 'disabled',
    errMap: {
      EMPTY_FILE: 'File is empty', FILE_TOO_LARGE: 'File exceeds 5 MB',
      INVALID_JSON: 'Not valid JSON', INVALID_ROOT: 'Invalid backup file',
      UNSUPPORTED_VERSION: 'Unsupported backup version', NO_VALID_ENTRY: 'No valid extension entries',
      LIST_FAILED: 'Failed to list cloud backups', UPLOAD_FAILED: 'Upload failed', DOWNLOAD_FAILED: 'Download failed'
    }
  }
};
const T = LOCALES[(navigator.language || 'en').startsWith('zh') ? 'zh' : 'en'];
const tErr = (e) => T.errMap[e.code] || (e.code ? e.code : String(e.message || e));

// 运行浏览器检测：Edge 的扩展商店商品与 Chrome Web Store 的 ID 体系不同，
// 恢复时必须打开对应浏览器的商店入口（userAgentData 与 UA 双保险）
function isEdgeBrowser() {
  try {
    const brands = navigator.userAgentData && navigator.userAgentData.brands;
    if (brands && brands.length) return brands.some((b) => /edge/i.test(b.brand));
  } catch (e) { /* 继续 UA 检测 */ }
  return /Edg\//.test(navigator.userAgent || '');
}
const IS_EDGE = isEdgeBrowser();

// Edge 商店支持纯 ID 直达（实测 microsoftedge.microsoft.com/addons/detail/<id> 可正常渲染商品页）
function edgeStoreUrl(id) {
  return 'https://microsoftedge.microsoft.com/addons/detail/' + id;
}

// 生成商店入口 URL。优先按备份记录的原来源商店（storeHost），
// 旧备份无该字段时按运行浏览器兜底
function resolveStoreUrl(ext) {
  const host = ext.storeHost || '';
  if (host === 'edge') return edgeStoreUrl(ext.id);
  if (host === 'cws') return getStoreUrl(ext.id);
  if (IS_EDGE) return edgeStoreUrl(ext.id);
  return getStoreUrl(ext.id);
}

/* ---------------- 状态 ---------------- */

const state = {
  installed: [],      // 本机扩展（toPlugin 格式，icons 为原始 url map）
  importDoc: null,    // 导入的备份文档
  webdavCfg: null,    // WebDAV 配置
  filter: '',
  filters: { status: 'all', source: 'all' },
  selected: new Set() // 勾选的扩展 id
};

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/* ---------------- 图标便携化（与原扩展一致，仅页面环境可用） ---------------- */

const ICON_SIZES = ['48', '32', '16', '128'];

function isPortableDataUri(uri) {
  return /^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(uri) && uri.length <= 100000;
}

function selectIcon(icons) {
  if (!icons || typeof icons !== 'object') return undefined;
  for (const s of ICON_SIZES) if (icons[s]) return icons[s];
  const values = Object.values(icons);
  return values.length ? values[0] : undefined;
}

function fetchIconDataUri(url) {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(undefined), 2000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 48; canvas.height = 48;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(undefined); return; }
        ctx.drawImage(img, 0, 0, 48, 48);
        const uri = canvas.toDataURL('image/png');
        resolve(isPortableDataUri(uri) ? uri : undefined);
      } catch (e) { resolve(undefined); }
    };
    img.onerror = () => { clearTimeout(timer); resolve(undefined); };
    img.src = url;
  });
}

async function makePluginIconPortable(plugin) {
  const icon = selectIcon(plugin.icons);
  if (!icon) return Object.assign({}, plugin, { icons: {} });
  if (isPortableDataUri(icon)) return Object.assign({}, plugin, { icons: { '48': icon } });
  try {
    const converted = await fetchIconDataUri(icon);
    if (converted && isPortableDataUri(converted)) {
      return Object.assign({}, plugin, { icons: { '48': converted } });
    }
  } catch (e) { /* ignore */ }
  return Object.assign({}, plugin, { icons: icon.startsWith('https://') ? { '48': icon } : {} });
}

/* ---------------- 轻提示 ---------------- */

let toastTimer = null;

function setStatusMsg(msg, type) {
  let t = document.getElementById('toast');
  if (!t) {
    t = el('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'toast' + (type === 'err' || type === 'error' ? ' toast-err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast hide'; }, 2500);
}

/* ---------------- 扩展列表 ---------------- */

async function refreshInstalled() {
  const all = await chrome.management.getAll();
  state.installed = all
    .filter((e) => e.type === 'extension' && e.id !== chrome.runtime.id)
    .map((info) => toPlugin(info)); // 不传 icons：构建原始 URL map 供列表显示
  const ids = new Set(state.installed.map((p) => p.id));
  for (const id of [...state.selected]) if (!ids.has(id)) state.selected.delete(id);
  renderList();
  renderRecovery();
}

function iconUrl(plugin) {
  const url = selectIcon(plugin.icons) || '';
  return url || 'icons/icon128.png';
}

function renderList() {
  const list = $('extList');
  list.innerHTML = '';
  const kw = state.filter.toLowerCase();
  const { status, source } = state.filters;
  const shown = state.installed.filter((p) => {
    if (kw && !p.name.toLowerCase().includes(kw)) return false;
    if (status === 'enabled' && !p.enabled) return false;
    if (status === 'disabled' && p.enabled) return false;
    if (source !== 'all' && p.source !== source) return false;
    return true;
  });
  for (const p of shown) {
    const row = el('div', 'ext-item' + (p.enabled ? '' : ' off'));
    const sel = document.createElement('input');
    sel.type = 'checkbox';
    sel.className = 'sel';
    sel.checked = state.selected.has(p.id);
    sel.addEventListener('change', () => {
      if (sel.checked) state.selected.add(p.id); else state.selected.delete(p.id);
      updateExportBtn();
    });
    const img = document.createElement('img');
    img.className = 'icon';
    img.src = iconUrl(p);
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => { img.src = 'icons/icon128.png'; };
    const info = el('div', 'ext-info');
    const line = el('div', 'ext-line');
    const name = el('div', 'ext-name', p.name);
    name.title = p.name + (p.description ? ' — ' + p.description : '');
    line.appendChild(name);
    const meta = el('div', 'ext-meta', `v${p.version || '?'} · ${sourceLabel(p)}`);
    info.appendChild(line);
    info.appendChild(meta);
    // 右侧控件组（与启停开关同一行、垂直居中）
    const right = el('div', 'row-actions');
    if (p.storeHost === 'cws' || p.storeHost === 'edge') {
      const tag = el('span', 'host-tag ' + p.storeHost, p.storeHost === 'edge' ? T.hostEdge : T.hostChrome);
      tag.title = p.storeHost === 'edge' ? T.hostEdgeTip : T.hostChromeTip;
      right.appendChild(tag);
      // Edge 商店来源：追加「⇗ Chrome」迁移入口
      if (p.storeHost === 'edge') {
        const migrate = el('button', 'migrate-btn', T.migrateToChrome);
        migrate.title = T.migrateToChromeTip;
        migrate.addEventListener('click', () => {
          chrome.tabs.create({ url: 'https://chromewebstore.google.com/search/' + encodeURIComponent(p.name) });
        });
        right.appendChild(migrate);
      }
    }
    const sw = el('label', 'switch');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = p.enabled;
    cb.disabled = !p.manageable;
    cb.addEventListener('change', async () => {
      try { await chrome.management.setEnabled(p.id, cb.checked); }
      catch (e) { cb.checked = !cb.checked; }
    });
    const track = el('span', 'track');
    sw.appendChild(cb);
    sw.appendChild(track);
    row.appendChild(sel);
    row.appendChild(img);
    row.appendChild(info);
    if (right.children.length) row.appendChild(right);
    row.appendChild(sw);
    list.appendChild(row);
  }
  $('emptyTip').hidden = shown.length > 0;
  $('extCount').textContent = `${shown.length}/${state.installed.length}`;
  updateExportBtn();
}

function sourceLabel(p) {
  const map = {
    store: T.srcStore, development: T.srcDev, policy: T.srcPolicy,
    sideload: T.srcSideload, other: T.srcOther
  };
  return map[p.source] || p.source;
}

function updateExportBtn() {
  const n = state.selected.size || state.installed.length;
  $('btnExport').textContent = T.exportCount(n);
  $('btnExport').disabled = state.installed.length === 0;
}

/* ---------------- 导出 ---------------- */

async function exportSelected() {
  const chosen = state.selected.size
    ? state.installed.filter((p) => state.selected.has(p.id))
    : state.installed.slice();
  if (!chosen.length) return;
  $('btnExport').disabled = true;
  try {
    const portable = [];
    for (let i = 0; i < chosen.length; i += 8) {
      const done = await Promise.all(chosen.slice(i, i + 8).map(makePluginIconPortable));
      portable.push(...done);
    }
    const doc = buildBackupDocument(portable, chrome.runtime.getManifest().version);
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chrome-plugins.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch (e) {
    alert(T.backupFail(tErr(e)));
  } finally {
    $('btnExport').disabled = false;
  }
}

/* ---------------- 导入 / 恢复 ---------------- */

async function importFile(file) {
  if (!file) return;
  try {
    const doc = parseImportText(await file.text());
    state.importDoc = doc;
    await chrome.storage.local.set({ importDoc: doc });
    setStatusMsg(T.importOk(doc.extensions.length), 'ok');
    renderRecovery();
  } catch (e) {
    alert(T.importFail(tErr(e)));
  }
}

function clearImport() {
  state.importDoc = null;
  chrome.storage.local.remove('importDoc');
  renderRecovery();
}

function renderRecovery() {
  const box = $('recoveryBox');
  const doc = state.importDoc;
  if (!doc) { box.hidden = true; return; }
  box.hidden = false;
  const installedIds = new Set(state.installed.map((p) => p.id));
  const missing = [];
  const done = [];
  const unavailable = [];
  for (const ext of doc.extensions) {
    if (installedIds.has(ext.id)) done.push(ext);
    else if (ext.storeRestorable) missing.push(ext);
    else unavailable.push(ext);
  }
  const total = doc.extensions.length;

  $('recoveryStats').textContent =
    `${T.restored} ${done.length} · ${T.missing} ${missing.length}` +
    (unavailable.length ? ` · ${T.unavailable} ${unavailable.length}` : '');

  // 恢复进度条
  const prog = $('recoveryProgress');
  prog.hidden = false;
  prog.firstElementChild.style.width = total ? (done.length / total * 100).toFixed(1) + '%' : '0%';

  const list = $('recoveryList');
  list.innerHTML = '';
  const items = [...missing, ...unavailable];
  list.classList.toggle('recovery-list-scroll', items.length > 8);
  for (const ext of items) {
    const row = el('div', 'recovery-item');
    const img = document.createElement('img');
    img.src = selectIcon(ext.icons) || 'icons/icon128.png';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => { img.src = 'icons/icon128.png'; };
    const name = el('span', 'rname', ext.name);
    name.title = `${ext.name} v${ext.version || '?'}`;
    row.appendChild(img);
    row.appendChild(name);
    if (ext.storeRestorable) {
      const btn = el('button', 'go', T.installNext);
      btn.addEventListener('click', () => {
        const url = resolveStoreUrl(ext);
        if (url) chrome.tabs.create({ url });
      });
      row.appendChild(btn);
    } else {
      row.appendChild(el('span', 'tag na', T.unavailable));
    }
    list.appendChild(row);
  }
  if (items.length === 0) {
    list.appendChild(el('div', 'recovery-item', '🎉 ' + T.recoveryCompleteDetail));
  }
  const btn = $('btnInstallNext');
  btn.hidden = missing.length === 0;
  btn.textContent = done.length ? T.installNext : T.startRecovery;
  btn.onclick = () => {
    const currentMissing = missing.filter((e) => !new Set(state.installed.map((p) => p.id)).has(e.id));
    const target = currentMissing[0];
    if (target) {
      const url = resolveStoreUrl(target);
      if (url) chrome.tabs.create({ url });
    }
  };
}

/* ---------------- 云同步 ---------------- */

function cloudStatus(text, type) {
  const s = $('cloudStatus');
  s.textContent = text;
  s.className = 'cloud-status ' + (type || 'info');
}

function cloudBusy(busy) {
  $('cloudModal').querySelectorAll('button:not(.modal-close)').forEach((b) => { b.disabled = busy; });
}

function renderCloudBody() {
  const body = $('cloudBody');
  body.innerHTML = '';
  const cfg = state.webdavCfg;
  if (!cfg) {
    const server = el('input', 'w-input');
    server.placeholder = T.serverPh;
    server.id = 'wServer';
    const user = el('input', 'w-input');
    user.placeholder = T.userPh;
    user.id = 'wUser';
    const pass = el('input', 'w-input');
    pass.type = 'password';
    pass.placeholder = T.passPh;
    pass.id = 'wPass';
    const hint = el('div', 'w-hint');
    hint.textContent = (navigator.language || '').startsWith('zh')
      ? '支持任意 WebDAV 服务（如坚果云、Nextcloud、自建服务器）；部分服务需先在账户设置中获取「应用密码」'
      : 'Any WebDAV service works (e.g. Jianguoyun, Nextcloud, self-hosted); some providers require an app password';
    const save = el('button', 'btn primary full', T.saveAndTest);
    save.addEventListener('click', saveCloudConfig);
    body.appendChild(server);
    body.appendChild(user);
    body.appendChild(pass);
    body.appendChild(hint);
    body.appendChild(save);
  } else {
    const info = el('div', 'cloud-connected', `${T.connected}: ${cfg.server.replace(/\/+$/, '')}`);
    const backup = el('button', 'btn primary full', T.backupNow);
    backup.addEventListener('click', backupNow);
    const restore = el('button', 'btn full', T.restoreLatest);
    restore.style.marginTop = '8px';
    restore.addEventListener('click', restoreLatest);
    const check = el('label', 'w-check');
    const auto = document.createElement('input');
    auto.type = 'checkbox';
    auto.checked = !!cfg.autoBackup;
    auto.addEventListener('change', async () => {
      cfg.autoBackup = auto.checked;
      await saveConfig(cfg);
      cloudStatus(auto.checked ? T.autoOn : T.autoOff, 'info');
    });
    check.appendChild(auto);
    check.appendChild(document.createTextNode(T.autoBackupLabel));
    const row = el('div', 'w-row');
    const edit = el('button', 'btn-ghost', T.modify);
    edit.addEventListener('click', () => {
      state.webdavCfg = null;
      chrome.storage.local.remove(CONFIG_KEY);
      renderCloudBody();
    });
    const clear = el('button', 'btn-ghost', T.clearCfg);
    clear.addEventListener('click', () => {
      state.webdavCfg = null;
      chrome.storage.local.remove(CONFIG_KEY);
      renderCloudBody();
      cloudStatus(T.cfgCleared, 'info');
    });
    row.appendChild(edit);
    row.appendChild(clear);
    body.appendChild(info);
    body.appendChild(backup);
    body.appendChild(restore);
    body.appendChild(check);
    body.appendChild(row);
  }
}

async function saveCloudConfig() {
  const server = $('wServer').value.trim();
  const username = $('wUser').value.trim();
  const password = $('wPass').value;
  if (!server || !username || !password) { cloudStatus(T.needFields, 'err'); return; }
  cloudBusy(true);
  cloudStatus(T.testing, 'info');
  const cfg = { server, username, password, autoBackup: false };
  if (!(await testConnection(cfg))) {
    cloudBusy(false);
    cloudStatus(T.connFail, 'err');
    return;
  }
  cloudStatus(T.creatingFolder, 'info');
  if (!(await ensureFolder(cfg))) {
    cloudBusy(false);
    cloudStatus(T.folderFail, 'err');
    return;
  }
  state.webdavCfg = cfg;
  await saveConfig(cfg);
  cloudBusy(false);
  renderCloudBody();
  cloudStatus(T.cfgOk, 'ok');
}

async function backupNow() {
  cloudBusy(true);
  cloudStatus(T.backuping, 'info');
  try {
    const plugins = [];
    for (let i = 0; i < state.installed.length; i += 8) {
      const done = await Promise.all(state.installed.slice(i, i + 8).map(makePluginIconPortable));
      plugins.push(...done);
    }
    cloudStatus(T.uploading(plugins.length), 'info');
    const doc = buildBackupDocument(plugins, chrome.runtime.getManifest().version);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    await uploadText(state.webdavCfg, `backup_${ts}.json`, JSON.stringify(doc, null, 2));
    cloudStatus(T.backupOk(plugins.length), 'ok');
  } catch (e) {
    cloudStatus(T.backupFail(tErr(e)), 'err');
  } finally {
    cloudBusy(false);
  }
}

async function restoreLatest() {
  cloudBusy(true);
  cloudStatus(T.listing, 'info');
  try {
    const files = await listBackups(state.webdavCfg);
    if (!files.length) { cloudStatus(T.noCloudBackup, 'err'); return; }
    const latest = files[0];
    cloudStatus(T.downloading(latest), 'info');
    const doc = parseImportText(await downloadText(state.webdavCfg, latest));
    if (!window.confirm(T.restoreConfirm(latest, doc.extensions.length))) {
      cloudStatus(T.restoreCancelled, 'info');
      return;
    }
    state.importDoc = doc;
    await chrome.storage.local.set({ importDoc: doc });
    renderRecovery();
    cloudStatus(T.importOk(doc.extensions.length), 'ok');
  } catch (e) {
    cloudStatus(T.importFail(tErr(e)), 'err');
  } finally {
    cloudBusy(false);
  }
}

/* ---------------- 弹层 ---------------- */

function openModal(id) { $(id).hidden = false; }
function closeModal(id) { $(id).hidden = true; }

/* ---------------- 启动 ---------------- */

function applyStaticI18n() {
  document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = T[n.dataset.i18n] || n.textContent; });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((n) => { n.placeholder = T[n.dataset.i18nPlaceholder] || n.placeholder; });
  document.querySelectorAll('[data-i18n-title]').forEach((n) => { n.title = T[n.dataset.i18nTitle] || n.title; });
}

async function init() {
  applyStaticI18n();
  document.title = T.appName;

  state.webdavCfg = await loadConfig();
  const stored = await chrome.storage.local.get('importDoc');
  state.importDoc = (stored && stored.importDoc) || null;

  state.selected = new Set(state.installed.map((p) => p.id));
  await refreshInstalled();

  // management 事件：本机扩展变化时刷新列表与恢复区
  chrome.management.onInstalled.addListener(refreshInstalled);
  chrome.management.onUninstalled.addListener(refreshInstalled);
  chrome.management.onEnabled.addListener(refreshInstalled);
  chrome.management.onDisabled.addListener(refreshInstalled);

  $('search').addEventListener('input', (e) => { state.filter = e.target.value.trim(); renderList(); });
  $('selAll').addEventListener('change', (e) => {
    const kw = state.filter.toLowerCase();
    const shown = state.installed.filter((p) => !kw || p.name.toLowerCase().includes(kw));
    if (e.target.checked) shown.forEach((p) => state.selected.add(p.id));
    else shown.forEach((p) => state.selected.delete(p.id));
    renderList();
  });
  $('btnExport').addEventListener('click', exportSelected);
  $('btnFilter').addEventListener('click', () => {
    const bar = $('filterBar');
    bar.hidden = !bar.hidden;
    $('btnFilter').classList.toggle('active', !bar.hidden);
    $('btnFilter').setAttribute('aria-expanded', String(!bar.hidden));
  });
  document.querySelectorAll('.fchip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const key = chip.dataset.fkey;
      state.filters[key] = chip.dataset.fval;
      chip.parentElement.querySelectorAll('.fchip').forEach((c) => c.classList.toggle('active', c === chip));
      renderList();
    });
  });
  $('btnClearFilters').addEventListener('click', () => {
    state.filters = { status: 'all', source: 'all' };
    document.querySelectorAll('.fgroup').forEach((g) => {
      g.querySelectorAll('.fchip').forEach((c) => c.classList.toggle('active', c.dataset.fval === 'all'));
    });
    renderList();
  });
  $('btnImport').addEventListener('click', () => $('fileImport').click());
  $('fileImport').addEventListener('change', (e) => {
    importFile(e.target.files[0]);
    e.target.value = '';
  });
  $('btnClearImport').addEventListener('click', clearImport);
  $('btnCloud').addEventListener('click', () => { renderCloudBody(); cloudStatus('', 'info'); openModal('cloudModal'); });
  $('btnDonate').addEventListener('click', () => openModal('donateModal'));
  document.querySelectorAll('.modal').forEach((m) => {
    m.addEventListener('click', (e) => { if (e.target === m) m.hidden = true; });
  });
  document.querySelectorAll('[data-close]').forEach((b) => {
    b.addEventListener('click', () => closeModal(b.dataset.close));
  });
}

init();
