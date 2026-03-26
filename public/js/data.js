/* ─────────────────────────────────────────────
   data.js — Data Layer v2
   Backend: Supabase (with localStorage fallback for pod-scoped data)
   Public API unchanged — app.js needs no modifications.
   ───────────────────────────────────────────── */

const DataLayer = (() => {
  let _config = null;

  // ── Helpers ──────────────────────────────────────────────────────────────

  // Convert Supabase pod_metrics rows → stats object expected by app.js
  function _buildPodStats(rows) {
    const sorted = (rows || []).slice().sort((a, b) => a.week_start.localeCompare(b.week_start));
    const latest = sorted[sorted.length - 1] || {};
    return {
      weeklyIncoming:   sorted.map(r => r.incoming   || 0),
      weeklyThroughput: sorted.map(r => r.throughput  || 0),
      weeklyAHT:        sorted.map(r => parseFloat(r.aht_hours) || 0),
      responseSLA:      parseFloat(latest.response_sla_pct   || 0),
      resolutionSLA:    parseFloat(latest.resolution_sla_pct || 0),
      totalBreaches:    latest.total_breaches    || 0,
      totalEscalations: latest.total_escalations || 0,
      weeks: sorted.map(r => {
        const d = new Date(r.week_start + 'T12:00:00Z');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }),
    };
  }

  // Fire-and-forget Supabase write — logs errors but never blocks UI
  function _sb(promise) {
    promise.then(({ error }) => {
      if (error) console.warn('[DataLayer:supabase]', error.message);
    });
  }

  // ── Load ─────────────────────────────────────────────────────────────────

  // Fetch pre-built Jira metrics from GitHub Actions output.
  // Returns an object keyed by pod id, or {} if unavailable.
  async function _fetchJiraMetrics() {
    try {
      const res = await fetch('/data/metrics.json?_=' + Date.now());
      if (!res.ok) return {};
      const json = await res.json();
      return (json && json.pods) ? json.pods : {};
    } catch (e) {
      return {};
    }
  }

  async function load() {
    const prevStickers = _config?.stickers || [];
    try {
      const [
        { data: pods,          error: e1 },
        { data: metrics,       error: e2 },
        { data: members,       error: e3 },
        { data: bulletin,      error: e4 },
        { data: announcements, error: e5 },
        { data: spotlightRows, error: e6 },
        { data: apps,          error: e7 },
        { data: meetings,      error: e8 },
        { data: onCallRows,    error: e9 },
        { data: stickers,      error: e10 },
        jiraMetrics,
      ] = await Promise.all([
        sb.from('pods').select('*').order('id'),
        sb.from('pod_metrics').select('*').order('week_start'),
        sb.from('team_members').select('*').order('name'),
        sb.from('bulletin_posts').select('*').is('pod_id', null).order('created_at', { ascending: false }),
        sb.from('announcements').select('*').eq('active', true).order('created_at', { ascending: false }),
        sb.from('spotlight').select('*').order('week_of', { ascending: false }).limit(1),
        sb.from('certified_apps').select('*').is('pod_id', null).order('sort_order'),
        sb.from('meetings').select('*').order('start_time'),
        sb.from('on_call').select('*').limit(1),
        sb.from('stickers').select('*').is('pod_id', null),
        _fetchJiraMetrics(),
      ]);

      for (const [label, err] of [['pods',e1],['metrics',e2],['members',e3],['bulletin',e4],
        ['announcements',e5],['spotlight',e6],['apps',e7],['meetings',e8],['on_call',e9],['stickers',e10]]) {
        if (err) console.warn(`[DataLayer] Supabase error loading ${label}:`, err.message);
      }

      // Group metrics by pod_id
      const metricsById = {};
      for (const m of (metrics || [])) {
        (metricsById[m.pod_id] = metricsById[m.pod_id] || []).push(m);
      }

      // Map pod id → short name for member pod labels
      const podNameById = {};
      (pods || []).forEach(p => { podNameById[p.id] = p.short_name; });

      const teamMembers = (members || []).map(m => ({
        id:            m.id,
        name:          m.name,
        pod:           m.pod_id ? (podNameById[m.pod_id] || m.pod_id) : 'Management',
        role:          m.role,
        title:         m.title,
        slackId:       m.slack_id,
        status:        m.status        || 'online',
        statusMessage: m.status_message || '',
        statusEmoji:   m.status_emoji   || '',
      }));

      const onCall = onCallRows?.[0];

      _config = {
        pods: (pods || []).map(p => {
          const supabaseStats = _buildPodStats(metricsById[p.id]);
          const jira = jiraMetrics[p.id];
          // Jira data wins when available and has no error; Supabase is the fallback
          const stats = (jira && !jira.error)
            ? {
                weeklyIncoming:   jira.weeklyIncoming   || supabaseStats.weeklyIncoming,
                weeklyThroughput: jira.weeklyThroughput || supabaseStats.weeklyThroughput,
                weeklyAHT:        jira.weeklyAHT        || supabaseStats.weeklyAHT,
                responseSLA:      jira.responseSLA      ?? supabaseStats.responseSLA,
                resolutionSLA:    jira.resolutionSLA    ?? supabaseStats.resolutionSLA,
                totalBreaches:    jira.totalBreaches    ?? supabaseStats.totalBreaches,
                totalEscalations: jira.totalEscalations ?? supabaseStats.totalEscalations,
                weeks:            jira.weeks            || supabaseStats.weeks,
                openCount:        jira.openCount,
                jiraFetchedAt:    jira.fetchedAt,
              }
            : supabaseStats;
          return { id: p.id, shortName: p.short_name, fullName: p.full_name,
                   icon: p.icon, color: p.color, stats };
        }),

        teamMembers,

        bulletin: (bulletin || []).map(b => ({
          id:        b.id,
          title:     b.title,
          body:      b.body,
          createdAt: b.created_at,
          author:    b.author,
          highlight: b.highlight_color,
          textColor: b.text_color,
        })),

        announcements: (announcements || []).map(a => ({
          id:     a.id,
          text:   a.text,
          link:   a.link,
          active: a.active,
        })),

        spotlight: spotlightRows?.[0] ? {
          type:    spotlightRows[0].type,
          title:   spotlightRows[0].title,
          name:    spotlightRows[0].name,
          pod:     spotlightRows[0].pod,
          avatar:  spotlightRows[0].avatar,
          message: spotlightRows[0].message,
        } : null,

        certifiedApps: (apps || []).map(a => ({
          id:   a.id,
          name: a.name,
          url:  a.url,
          icon: a.icon,
        })),

        meetings: (meetings || []).map(m => ({
          id:              m.id,
          title:           m.title,
          start:           m.start_time,
          durationMinutes: m.duration_minutes,
          meetingLink:     m.meeting_link,
          attendees:       m.attendees || [],
        })),

        onCall: onCall ? {
          name:          onCall.name,
          link:          onCall.link,
          inIncident:    onCall.in_incident,
          incidentNote:  onCall.incident_note,
          opsgenieCalUrl: 'webcal://instacart.app.opsgenie.com/webapi/webcal/getRecentSchedule?webcalToken=7556950f844ed9d3ab41de34bb70240322070f7669e9d2a0f98fb03b1f9bbe25&scheduleId=0bdcc631-f582-4a80-b87b-30e3f0a215b0',
          afterHours: { name: '', calendarUrl: '' },
        } : null,

        stickers: (stickers || []).map(s => ({
          id:          s.id,
          icon:        s.content,    // DB column is 'content'; renderStickers() uses 'icon'
          tooltipText: s.tooltip_text || '',
          x:           parseFloat(s.x),
          y:           parseFloat(s.y),
          color:       s.color,
          placedBy:    s.author,
          persistent:  s.persistent,
          expiresAt:   s.expires_at,
        })),

        admins: teamMembers.filter(m => m.role === 'manager').map(m => m.name),

        settings: {
          bannerColor: '#EF4444',
          podColors: { Ads: '#3B82F6', Cat: '#22C55E', Caper: '#F97316', FaaS: '#8B5CF6', FS: '#EF4444', WL: '#14B8A6' },
          slackChannelId: 'C02QBM042KC',
          slackChannelName: 'Team ETS',
          podChannels: { Ads: 'C073V4FR1DE', Cat: '', Caper: 'C05L86U993N', FaaS: 'C060VQ316KT', FS: 'C077P6VE9EE', WL: 'C073676HT5H' },
        },
      };

      // Preserve optimistic stickers: locally-added ones not yet confirmed in Supabase.
      // Without this, the 15s refresh overwrites _config.stickers before the async
      // Supabase write lands, causing stickers to vanish on the next render().
      const freshIds = new Set(_config.stickers.map(s => s.id));
      const pending  = prevStickers.filter(s => !freshIds.has(s.id));
      if (pending.length > 0) _config.stickers = [..._config.stickers, ...pending];

      return _config;
    } catch (err) {
      console.error('[DataLayer] Failed to load from Supabase:', err);
      return _config;
    }
  }

  function getConfig()      { return _config; }
  function getPods()        { return _config?.pods        || []; }
  function getMeetings()    { return _config?.meetings     || []; }
  function getOnCall()      { return _config?.onCall       || null; }
  function getStickers()    { return _config?.stickers     || []; }
  function getAdmins()      { return _config?.admins       || []; }
  function getSettings()    { return _config?.settings     || {}; }

  // ── Team Members ──────────────────────────────────────────────────────────

  function getTeamMembers()  { return _config?.teamMembers || []; }
  function getTeamRoster()   { return getTeamMembers(); }

  function saveTeamRoster(members) {
    if (_config) _config.teamMembers = members;
  }

  function addTeamMember(member) {
    member.id = crypto.randomUUID();
    member.status = 'online';
    member.statusMessage = '';
    member.statusEmoji = '';
    const members = getTeamMembers();
    members.push(member);
    saveTeamRoster(members);
    _sb(sb.from('team_members').insert({
      id: member.id, name: member.name,
      pod_id: _podIdFromName(member.pod),
      role: member.role || 'member', title: member.title, slack_id: member.slackId,
    }));
    return members;
  }

  function removeTeamMember(id) {
    const members = getTeamMembers().filter(m => m.id !== id);
    saveTeamRoster(members);
    if (_config) _config.teamMembers = members;
    _sb(sb.from('team_members').delete().eq('id', id));
    return members;
  }

  function updateTeamMember(id, updates) {
    const members = getTeamMembers();
    const member = members.find(m => m.id === id);
    if (member) Object.assign(member, updates);
    saveTeamRoster(members);
    // Map camelCase → snake_case for Supabase
    const dbUpdates = {};
    if (updates.status        !== undefined) dbUpdates.status         = updates.status;
    if (updates.statusMessage !== undefined) dbUpdates.status_message = updates.statusMessage;
    if (updates.statusEmoji   !== undefined) dbUpdates.status_emoji   = updates.statusEmoji;
    if (Object.keys(dbUpdates).length > 0) {
      _sb(sb.from('team_members').update(dbUpdates).eq('id', id));
    }
    return members;
  }

  // Helper: get pod_id from pod short name
  function _podIdFromName(podName) {
    if (!podName || podName === 'Management') return null;
    const pod = (_config?.pods || []).find(p => p.shortName === podName);
    return pod?.id || podName.toLowerCase();
  }

  // ── Bulletin ──────────────────────────────────────────────────────────────

  function getBulletin()        { return _config?.bulletin || []; }
  function saveBulletin(items)  { if (_config) _config.bulletin = items; }

  function addBulletinItem(item) {
    const items = getBulletin();
    item.id        = crypto.randomUUID();
    item.createdAt = new Date().toISOString();
    item.author    = getUser() || 'Anonymous';
    items.unshift(item);
    saveBulletin(items);
    _sb(sb.from('bulletin_posts').insert({
      id: item.id, title: item.title, body: item.body,
      author: item.author, highlight_color: item.highlight,
      text_color: item.textColor, pod_id: null,
    }));
    return items;
  }

  function removeBulletinItem(id) {
    const items = getBulletin().filter(b => b.id !== id);
    saveBulletin(items);
    _sb(sb.from('bulletin_posts').delete().eq('id', id));
    return items;
  }

  function updateBulletinItem(id, updates) {
    const items = getBulletin();
    const item = items.find(b => b.id === id);
    if (item) Object.assign(item, updates);
    saveBulletin(items);
    _sb(sb.from('bulletin_posts').update({
      title: updates.title, body: updates.body,
      highlight_color: updates.highlight, text_color: updates.textColor,
    }).eq('id', id));
    return items;
  }

  // ── Announcements ─────────────────────────────────────────────────────────

  function getAnnouncements()      { return _config?.announcements || []; }
  function saveAnnouncements(arr)  { if (_config) _config.announcements = arr; }
  function getBannerColor()        { return _config?.settings?.bannerColor || '#EF4444'; }
  function saveBannerColor(color)  {
    if (_config?.settings) _config.settings.bannerColor = color;
    try { localStorage.setItem('ets_banner_color', color); } catch(e) {}
  }

  // ── Spotlight ────────────────────────────────────────────────────────────

  function getSpotlight() { return _config?.spotlight || null; }

  function saveSpotlight(data) {
    if (_config) _config.spotlight = data;
    _sb(sb.from('spotlight').insert({
      type: data.type, title: data.title, name: data.name,
      pod: data.pod, avatar: data.avatar, message: data.message,
      week_of: new Date().toISOString().split('T')[0],
      created_by: getUser() || 'Anonymous',
    }));
  }

  // ── Certified Apps ────────────────────────────────────────────────────────

  function getCertifiedApps() { return _config?.certifiedApps || []; }

  function saveCertifiedApps(apps) { if (_config) _config.certifiedApps = apps; }

  function addCertifiedApp(app) {
    const apps = getCertifiedApps();
    app.id = crypto.randomUUID();
    apps.push(app);
    saveCertifiedApps(apps);
    _sb(sb.from('certified_apps').insert({
      id: app.id, name: app.name, url: app.url, icon: app.icon,
      pod_id: null, sort_order: apps.length,
    }));
    return apps;
  }

  function removeCertifiedApp(id) {
    const apps = getCertifiedApps().filter(a => a.id !== id);
    saveCertifiedApps(apps);
    _sb(sb.from('certified_apps').delete().eq('id', id));
    return apps;
  }

  function updateCertifiedApp(id, updates) {
    const apps = getCertifiedApps();
    const app = apps.find(a => a.id === id);
    if (app) Object.assign(app, updates);
    saveCertifiedApps(apps);
    _sb(sb.from('certified_apps').update({ name: updates.name, url: updates.url, icon: updates.icon }).eq('id', id));
    return apps;
  }

  // ── Stickers (global) ────────────────────────────────────────────────────

  let _stickerScope = null; // null = global, podId = pod-scoped

  function setStickerScope(podId) { _stickerScope = podId || null; }

  function loadStickers() {
    // Pod stickers still use localStorage (pod.html doesn't go through Supabase load)
    if (_stickerScope) {
      try {
        const stored = localStorage.getItem('ets_pod_stickers_' + _stickerScope);
        if (stored) {
          const stickers = JSON.parse(stored);
          const now = Date.now();
          return stickers.filter(s => s.persistent || !s.expiresAt || new Date(s.expiresAt).getTime() > now);
        }
      } catch (e) {}
      return [];
    }
    // Global stickers come from _config (loaded from Supabase)
    const now = Date.now();
    return (_config?.stickers || []).filter(s => s.persistent || !s.expiresAt || new Date(s.expiresAt).getTime() > now);
  }

  function saveStickers(stickers) {
    if (_stickerScope) {
      try { localStorage.setItem('ets_pod_stickers_' + _stickerScope, JSON.stringify(stickers)); } catch(e) {}
    } else {
      if (_config) _config.stickers = stickers;
    }
  }

  function addSticker(sticker) {
    const stickers = loadStickers();
    stickers.push(sticker);
    saveStickers(stickers);
    if (!_stickerScope) {
      _sb(sb.from('stickers').insert({
        id: sticker.id, content: sticker.icon || sticker.content,
        x: sticker.x, y: sticker.y, color: sticker.color,
        author: sticker.author, persistent: sticker.persistent || false,
        expires_at: sticker.expiresAt || null, pod_id: null,
      }));
    }
    return stickers;
  }

  function removeSticker(id) {
    const stickers = loadStickers().filter(s => s.id !== id);
    saveStickers(stickers);
    if (!_stickerScope) {
      _sb(sb.from('stickers').delete().eq('id', id));
    }
    return stickers;
  }

  // Debounce position updates to avoid spamming Supabase on drag
  const _posDebounce = {};
  function updateStickerPosition(id, x, y) {
    const stickers = loadStickers();
    const s = stickers.find(s => s.id === id);
    if (s) { s.x = x; s.y = y; }
    saveStickers(stickers);
    if (!_stickerScope) {
      clearTimeout(_posDebounce[id]);
      _posDebounce[id] = setTimeout(() => {
        _sb(sb.from('stickers').update({ x, y }).eq('id', id));
      }, 1000);
    }
    return stickers;
  }

  function toggleStickerPersistent(id) {
    const stickers = loadStickers();
    const s = stickers.find(s => s.id === id);
    if (s) {
      s.persistent = !s.persistent;
      s.expiresAt  = s.persistent ? null : new Date(Date.now() + 24*60*60*1000).toISOString();
    }
    saveStickers(stickers);
    if (!_stickerScope && s) {
      _sb(sb.from('stickers').update({ persistent: s.persistent, expires_at: s.expiresAt }).eq('id', id));
    }
    return stickers;
  }

  function clearAllStickers() {
    saveStickers([]);
    if (!_stickerScope) {
      _sb(sb.from('stickers').delete().is('pod_id', null));
    }
    return [];
  }

  // ── Pod-Scoped Data (localStorage — pod.html) ─────────────────────────────

  function _podKey(type, podId) { return 'ets_pod_' + type + '_' + podId; }

  function getPodBulletin(podId) {
    try {
      const s = localStorage.getItem(_podKey('bulletin', podId));
      if (s) return JSON.parse(s);
    } catch(e) {}
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
      const s = localStorage.getItem(_podKey('apps', podId));
      if (s) return JSON.parse(s);
    } catch(e) {}
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
      const s = localStorage.getItem(_podKey('schedule', podId));
      if (s) return JSON.parse(s);
    } catch(e) {}
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

  function getPodSettings(podId) {
    try {
      const s = localStorage.getItem(_podKey('settings', podId));
      if (s) return JSON.parse(s);
    } catch(e) {}
    return {};
  }

  function savePodSettings(podId, settings) {
    localStorage.setItem(_podKey('settings', podId), JSON.stringify(settings));
  }

  // ── User Identity ─────────────────────────────────────────────────────────

  const USER_KEY    = 'ets_username';
  const PROFILE_KEY = 'ets_user_profile';

  function getUser()       { return localStorage.getItem(USER_KEY); }
  function setUser(name)   { localStorage.setItem(USER_KEY, name); }

  function getUserProfile() {
    try {
      const s = localStorage.getItem(PROFILE_KEY);
      if (s) return JSON.parse(s);
    } catch(e) {}
    return { statusIcon: '', tooltipText: '' };
  }

  function saveUserProfile(profile) {
    if (profile.statusIcon) addRecentProfileIcon(profile.statusIcon);
    if (profile.tooltipText) addRecentProfileText(profile.tooltipText);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }

  // ── Profile Recents ───────────────────────────────────────────────────────

  const RECENT_ICONS_KEY  = 'ets_recent_profile_icons';
  const RECENT_TEXTS_KEY  = 'ets_recent_profile_texts';
  const MAX_RECENTS = 5;

  function getRecentProfileIcons() {
    try { const s = localStorage.getItem(RECENT_ICONS_KEY); if (s) return JSON.parse(s); } catch(e) {}
    return [];
  }

  function addRecentProfileIcon(icon) {
    let arr = getRecentProfileIcons().filter(i => i !== icon);
    arr.unshift(icon);
    if (arr.length > MAX_RECENTS) arr = arr.slice(0, MAX_RECENTS);
    localStorage.setItem(RECENT_ICONS_KEY, JSON.stringify(arr));
  }

  function getRecentProfileTexts() {
    try { const s = localStorage.getItem(RECENT_TEXTS_KEY); if (s) return JSON.parse(s); } catch(e) {}
    return [];
  }

  function addRecentProfileText(text) {
    let arr = getRecentProfileTexts().filter(t => t !== text);
    arr.unshift(text);
    if (arr.length > MAX_RECENTS) arr = arr.slice(0, MAX_RECENTS);
    localStorage.setItem(RECENT_TEXTS_KEY, JSON.stringify(arr));
  }

  function isAdmin(name) {
    const admins = getAdmins();
    const n = (name || '').toLowerCase().trim();
    if (!n) return false;
    return admins.some(a => {
      const admin = a.toLowerCase();
      return admin === n || admin.startsWith(n + ' ') || n.startsWith(admin.split(' ')[0]);
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  return {
    load, getConfig, getPods, getTeamMembers, getMeetings,
    getBulletin, saveBulletin, addBulletinItem, removeBulletinItem, updateBulletinItem,
    getAnnouncements, saveAnnouncements, getBannerColor, saveBannerColor,
    getOnCall, getSpotlight, saveSpotlight, getCertifiedApps, getStickers,
    getAdmins, getSettings,
    saveCertifiedApps, addCertifiedApp, removeCertifiedApp, updateCertifiedApp,
    getTeamRoster, saveTeamRoster, addTeamMember, removeTeamMember, updateTeamMember,
    loadStickers, saveStickers, addSticker, removeSticker,
    updateStickerPosition, toggleStickerPersistent, clearAllStickers,
    setStickerScope,
    getPodBulletin, savePodBulletin, addPodBulletinItem, removePodBulletinItem,
    getPodApps, savePodApps, addPodApp, removePodApp,
    getPodSchedule, savePodSchedule, addPodScheduleItem, removePodScheduleItem,
    getPodSettings, savePodSettings,
    getUser, setUser, isAdmin,
    getUserProfile, saveUserProfile,
    getRecentProfileIcons, getRecentProfileTexts,
  };
})();
