/* ──────────────────────────────────────────────
   SlackStatus  –  Slack presence integration

   Fetches real-time presence (online/away/dnd) for
   team members via a proxy endpoint. Falls back to
   config defaults when the proxy isn't configured.

   Usage:
     SlackStatus.refresh()          // fetch & apply
     SlackStatus.getStatus(slackId) // get cached status
     SlackStatus.configure(url)     // set proxy URL
   ────────────────────────────────────────────── */
var SlackStatus = (function () {
  'use strict';

  var CACHE_KEY = 'ets_slack_presence';
  var CONFIG_KEY = 'ets_slack_proxy_url';
  var REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutes
  var _timer = null;

  // ── Cache ──
  function _loadCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function _saveCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); }
    catch (e) { /* quota */ }
  }

  // ── Proxy URL ──
  function getProxyUrl() {
    return localStorage.getItem(CONFIG_KEY) || '';
  }

  function configure(url) {
    localStorage.setItem(CONFIG_KEY, url || '');
  }

  // ── Fetch presence from proxy ──
  // Expected proxy response: { "U08744QQE0K": "active", "U042JLLDHJ9": "away", ... }
  // Valid values: "active", "away", "dnd"
  function _fetchFromProxy(slackIds) {
    var url = getProxyUrl();
    if (!url) return Promise.resolve(null);

    var endpoint = url + (url.indexOf('?') === -1 ? '?' : '&') +
                   'users=' + encodeURIComponent(slackIds.join(','));

    return fetch(endpoint, { method: 'GET', mode: 'cors' })
      .then(function (r) {
        if (!r.ok) throw new Error('Proxy returned ' + r.status);
        return r.json();
      })
      .catch(function (err) {
        console.warn('[SlackStatus] Proxy fetch failed:', err.message);
        return null;
      });
  }

  // ── Map Slack presence to dashboard status ──
  function _mapPresence(slackPresence) {
    switch (slackPresence) {
      case 'active': return 'online';
      case 'away':   return 'away';
      case 'dnd':    return 'dnd';
      default:       return 'offline';
    }
  }

  // ── Get all Slack IDs from config ──
  function _getSlackIds() {
    if (typeof DataLayer === 'undefined') return [];
    var members = DataLayer.getTeamMembers();
    return members
      .filter(function (m) { return m.slackId; })
      .map(function (m) { return m.slackId; });
  }

  // ── Apply statuses to config data ──
  function _applyStatuses(presenceMap) {
    if (!presenceMap || typeof DataLayer === 'undefined') return;
    var members = DataLayer.getTeamMembers();
    var updated = false;

    members.forEach(function (m) {
      if (m.slackId && presenceMap[m.slackId]) {
        var newStatus = _mapPresence(presenceMap[m.slackId]);
        if (m.status !== newStatus) {
          m.status = newStatus;
          updated = true;
        }
        // Also pick up status emoji/text if the proxy returns it
        if (presenceMap[m.slackId + '_emoji']) {
          m.statusEmoji = presenceMap[m.slackId + '_emoji'];
        }
        if (presenceMap[m.slackId + '_text']) {
          m.statusMessage = presenceMap[m.slackId + '_text'];
        }
      }
    });

    if (updated) {
      _saveCache(presenceMap);
      // Re-render team status if App is available
      if (typeof App !== 'undefined' && App.render) {
        App.render();
      }
    }
  }

  // ── Restore from cache on load ──
  function _restoreFromCache() {
    var cached = _loadCache();
    if (Object.keys(cached).length > 0) {
      _applyStatuses(cached);
    }
  }

  // ── Main refresh ──
  function refresh() {
    var ids = _getSlackIds();
    if (ids.length === 0) return Promise.resolve();

    return _fetchFromProxy(ids).then(function (presenceMap) {
      if (presenceMap) {
        _applyStatuses(presenceMap);
      }
    });
  }

  // ── Start auto-refresh loop ──
  function startPolling() {
    _restoreFromCache();
    refresh(); // immediate first fetch

    if (_timer) clearInterval(_timer);
    _timer = setInterval(refresh, REFRESH_INTERVAL);
  }

  function stopPolling() {
    if (_timer) {
      clearInterval(_timer);
      _timer = null;
    }
  }

  // ── Get cached status for a single user ──
  function getStatus(slackId) {
    var cached = _loadCache();
    return cached[slackId] ? _mapPresence(cached[slackId]) : null;
  }

  // ── Public API ──
  return {
    refresh: refresh,
    startPolling: startPolling,
    stopPolling: stopPolling,
    getStatus: getStatus,
    configure: configure,
    getProxyUrl: getProxyUrl
  };

})();
