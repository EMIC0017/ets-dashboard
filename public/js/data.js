/* ─────────────────────────────────────────────
   data.js — Data Layer
   v1: Static JSON.  Architected for Superblocks API swap.
   ───────────────────────────────────────────── */

const DataLayer = (() => {
  let _config = null;
  const DATA_URL = 'data/dashboard-config.json';

  // ── Public: fetch or return cached config ──
  async function load() {
    try {
      const res = await fetch(DATA_URL + '?t=' + Date.now()); // cache-bust
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      _config = await res.json();
      return _config;
    } catch (err) {
      console.error('[DataLayer] Failed to load config:', err);
      return _config; // return stale cache if available
    }
  }

  function getConfig() { return _config; }
  function getPods() { return _config?.pods || []; }
  const ROSTER_KEY = 'ets_team_roster';

  function getTeamMembers() {
    // If a custom roster exists in localStorage, use it
    try {
      const stored = localStorage.getItem(ROSTER_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    return _config?.teamMembers || [];
  }

  function getTeamRoster() {
    return getTeamMembers();
  }

  function saveTeamRoster(members) {
    localStorage.setItem(ROSTER_KEY, JSON.stringify(members));
  }

  function addTeamMember(member) {
    const members = getTeamMembers();
    member.id = crypto.randomUUID();
    member.status = 'online';
    member.statusMessage = '';
    member.statusEmoji = '';
    members.push(member);
    saveTeamRoster(members);
    return members;
  }

  function removeTeamMember(id) {
    const members = getTeamMembers().filter(m => m.id !== id);
    saveTeamRoster(members);
    return members;
  }

  function updateTeamMember(id, updates) {
    const members = getTeamMembers();
    const member = members.find(m => m.id === id);
    if (member) Object.assign(member, updates);
    saveTeamRoster(members);
    return members;
  }
  function getMeetings() { return _config?.meetings || []; }
  const BULLETIN_KEY = 'ets_bulletin';

  function getBulletin() {
    try {
      const stored = localStorage.getItem(BULLETIN_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    return _config?.bulletin || [];
  }

  function saveBulletin(items) {
    localStorage.setItem(BULLETIN_KEY, JSON.stringify(items));
  }

  function addBulletinItem(item) {
    const items = getBulletin();
    item.id = crypto.randomUUID();
    item.createdAt = new Date().toISOString();
    item.author = getUser() || 'Anonymous';
    items.unshift(item); // newest first
    saveBulletin(items);
    return items;
  }

  function removeBulletinItem(id) {
    const items = getBulletin().filter(b => b.id !== id);
    saveBulletin(items);
    return items;
  }

  function updateBulletinItem(id, updates) {
    const items = getBulletin();
    const item = items.find(b => b.id === id);
    if (item) Object.assign(item, updates);
    saveBulletin(items);
    return items;
  }
  var BANNER_KEY = 'ets_banner';

  function getAnnouncements() {
    // localStorage overrides config
    try {
      var stored = localStorage.getItem(BANNER_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    return _config?.announcements || [];
  }

  function saveAnnouncements(arr) {
    try { localStorage.setItem(BANNER_KEY, JSON.stringify(arr)); }
    catch (e) { /* quota */ }
  }

  function getBannerColor() {
    try {
      var c = localStorage.getItem('ets_banner_color');
      if (c) return c;
    } catch (e) { /* ignore */ }
    return (_config?.settings?.bannerColor) || '#EF4444';
  }

  function saveBannerColor(color) {
    try { localStorage.setItem('ets_banner_color', color); }
    catch (e) { /* quota */ }
  }
  function getOnCall() { return _config?.onCall || null; }
  function getSpotlight() { return _config?.spotlight || null; }
  function getCertifiedApps() {
    // Merge: start with config apps, apply localStorage overrides
    const APPS_KEY = 'ets_certified_apps';
    try {
      const stored = localStorage.getItem(APPS_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    return _config?.certifiedApps || [];
  }

  function saveCertifiedApps(apps) {
    localStorage.setItem('ets_certified_apps', JSON.stringify(apps));
  }

  function addCertifiedApp(app) {
    const apps = getCertifiedApps();
    app.id = crypto.randomUUID();
    apps.push(app);
    saveCertifiedApps(apps);
    return apps;
  }

  function removeCertifiedApp(id) {
    const apps = getCertifiedApps().filter(a => a.id !== id);
    saveCertifiedApps(apps);
    return apps;
  }

  function updateCertifiedApp(id, updates) {
    const apps = getCertifiedApps();
    const app = apps.find(a => a.id === id);
    if (app) Object.assign(app, updates);
    saveCertifiedApps(apps);
    return apps;
  }
  function getStickers() { return _config?.stickers || []; }
  function getAdmins() { return _config?.admins || []; }
  function getSettings() { return _config?.settings || {}; }

  // ── Sticker operations (v1: localStorage; future: Superblocks datastore) ──
  const STICKER_STORAGE_KEY = 'ets_stickers';

  function loadStickers() {
    try {
      const stored = localStorage.getItem(_stickerScope);
      if (stored) {
        const stickers = JSON.parse(stored);
        const now = Date.now();
        return stickers.filter(s => s.persistent || !s.expiresAt || new Date(s.expiresAt).getTime() > now);
      }
    } catch (e) { /* ignore parse errors */ }
    return [];
  }

  function saveStickers(stickers) {
    localStorage.setItem(_stickerScope, JSON.stringify(stickers));
  }

  function addSticker(sticker) {
    const stickers = loadStickers();
    stickers.push(sticker);
    saveStickers(stickers);
    return stickers;
  }

  function removeSticker(id) {
    const stickers = loadStickers().filter(s => s.id !== id);
    saveStickers(stickers);
    return stickers;
  }

  function updateStickerPosition(id, x, y) {
    const stickers = loadStickers();
    const s = stickers.find(s => s.id === id);
    if (s) { s.x = x; s.y = y; }
    saveStickers(stickers);
    return stickers;
  }

  function toggleStickerPersistent(id) {
    const stickers = loadStickers();
    const s = stickers.find(s => s.id === id);
    if (s) {
      s.persistent = !s.persistent;
      s.expiresAt = s.persistent ? null : new Date(Date.now() + 24*60*60*1000).toISOString();
    }
    saveStickers(stickers);
    return stickers;
  }

  function clearAllStickers() {
    saveStickers([]);
    return [];
  }

  // ── Pod-Scoped Data ──
  // Each pod gets its own bulletin, apps, and stickers via prefixed localStorage keys

  function _podKey(type, podId) {
    return 'ets_pod_' + type + '_' + podId;
  }

  function getPodBulletin(podId) {
    try {
      const stored = localStorage.getItem(_podKey('bulletin', podId));
      if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    return [];
  }

  function savePodBulletin(podId, items) {
    localStorage.setItem(_podKey('bulletin', podId), JSON.stringify(items));
  }

  function addPodBulletinItem(podId, item) {
    const items = getPodBulletin(podId);
    item.id = crypto.randomUUID();
    item.createdAt = new Date().toISOString();
    item.author = getUser() || 'Anonymous';
    items.unshift(item);
    savePodBulletin(podId, items);
    return items;
  }

  function removePodBulletinItem(podId, id) {
    const items = getPodBulletin(podId).filter(b => b.id !== id);
    savePodBulletin(podId, items);
    return items;
  }

  function getPodApps(podId) {
    try {
      const stored = localStorage.getItem(_podKey('apps', podId));
      if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    return [];
  }

  function savePodApps(podId, apps) {
    localStorage.setItem(_podKey('apps', podId), JSON.stringify(apps));
  }

  function addPodApp(podId, app) {
    const apps = getPodApps(podId);
    app.id = crypto.randomUUID();
    apps.push(app);
    savePodApps(podId, apps);
    return apps;
  }

  function removePodApp(podId, id) {
    const apps = getPodApps(podId).filter(a => a.id !== id);
    savePodApps(podId, apps);
    return apps;
  }

  function getPodSchedule(podId) {
    try {
      const stored = localStorage.getItem(_podKey('schedule', podId));
      if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    return [];
  }

  function savePodSchedule(podId, items) {
    localStorage.setItem(_podKey('schedule', podId), JSON.stringify(items));
  }

  function addPodScheduleItem(podId, item) {
    const items = getPodSchedule(podId);
    item.id = crypto.randomUUID();
    item.createdBy = getUser() || 'Anonymous';
    items.push(item);
    items.sort((a, b) => a.date.localeCompare(b.date));
    savePodSchedule(podId, items);
    return items;
  }

  function removePodScheduleItem(podId, id) {
    const items = getPodSchedule(podId).filter(s => s.id !== id);
    savePodSchedule(podId, items);
    return items;
  }

  // Pod-specific settings (background color, image, meme URL)
  function getPodSettings(podId) {
    try {
      const stored = localStorage.getItem(_podKey('settings', podId));
      if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    return {};
  }

  function savePodSettings(podId, settings) {
    localStorage.setItem(_podKey('settings', podId), JSON.stringify(settings));
  }

  // Scope-switching for stickers (allows Stickers module to work on pod pages)
  let _stickerScope = STICKER_STORAGE_KEY; // default: global

  function setStickerScope(podId) {
    _stickerScope = podId ? _podKey('stickers', podId) : STICKER_STORAGE_KEY;
  }

  // ── User Identity ──
  const USER_KEY = 'ets_username';

  function getUser() { return localStorage.getItem(USER_KEY); }
  function setUser(name) { localStorage.setItem(USER_KEY, name); }

  function isAdmin(name) {
    const admins = getAdmins();
    const n = (name || '').toLowerCase().trim();
    if (!n) return false;
    return admins.some(a => {
      const admin = a.toLowerCase();
      // Exact match, or first name match, or admin name starts with input
      return admin === n || admin.startsWith(n + ' ') || n.startsWith(admin.split(' ')[0]);
    });
  }

  return {
    load, getConfig, getPods, getTeamMembers, getMeetings,
    getBulletin, saveBulletin, addBulletinItem, removeBulletinItem, updateBulletinItem,
    getAnnouncements, saveAnnouncements, getBannerColor, saveBannerColor,
    getOnCall, getSpotlight, getCertifiedApps, getStickers,
    getAdmins, getSettings,
    saveCertifiedApps, addCertifiedApp, removeCertifiedApp, updateCertifiedApp,
    getTeamRoster, saveTeamRoster, addTeamMember, removeTeamMember, updateTeamMember,
    loadStickers, saveStickers, addSticker, removeSticker,
    updateStickerPosition, toggleStickerPersistent, clearAllStickers,
    // Pod-scoped
    setStickerScope,
    getPodBulletin, savePodBulletin, addPodBulletinItem, removePodBulletinItem,
    getPodApps, savePodApps, addPodApp, removePodApp,
    getPodSchedule, savePodSchedule, addPodScheduleItem, removePodScheduleItem,
    getPodSettings, savePodSettings,
    getUser, setUser, isAdmin
  };
})();
