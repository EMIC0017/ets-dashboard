/* ─────────────────────────────────────────────
   stickers.js — Sticker / Bubble System
   Search-powered emoji picker + draggable stickers
   ───────────────────────────────────────────── */

const Stickers = (() => {
  const RECENT_KEY = 'ets_sticker_recents';
  const MAX_RECENTS = 5;

  let _placingEmoji = null;
  let _dragState = null;
  let _searchDebounce = null;

  function init() {
    renderPicker();
    renderStickers();
    setupPlacementListener();

    document.getElementById('stickerAddBtn').addEventListener('click', togglePicker);
  }

  // ── Recent Emojis ──

  function getRecents() {
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    return [];
  }

  function addRecent(emoji) {
    let recents = getRecents().filter(e => e !== emoji);
    recents.unshift(emoji);
    if (recents.length > MAX_RECENTS) recents = recents.slice(0, MAX_RECENTS);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recents));
  }

  // ── Picker ──

  // Default popular emojis shown when no recents exist
  const POPULAR_DEFAULTS = [
    '\uD83C\uDF89', '\uD83D\uDD25', '\uD83D\uDE80', '\u2B50', '\uD83D\uDCAA', '\u2764\uFE0F'
  ];

  function renderPicker() {
    const picker = document.getElementById('stickerPicker');
    picker.textContent = '';

    // Quick-access row (recents or popular defaults) — ABOVE search
    const quickSection = document.createElement('div');
    quickSection.className = 'sticker-picker__quick-section';
    picker.appendChild(quickSection);
    renderQuickAccess(quickSection);

    // Search input
    const searchWrap = document.createElement('div');
    searchWrap.className = 'sticker-picker__search-wrap';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'sticker-picker__search';
    searchInput.placeholder = 'Search ' + (typeof EmojiData !== 'undefined' ? EmojiData.count() : '') + ' emojis...';
    searchInput.autocomplete = 'off';
    searchWrap.appendChild(searchInput);
    picker.appendChild(searchWrap);

    // Results grid
    const resultsGrid = document.createElement('div');
    resultsGrid.className = 'sticker-picker__results';
    picker.appendChild(resultsGrid);

    // Show initial state
    showDefaultEmojis(resultsGrid);

    // Search handler with debounce
    searchInput.addEventListener('input', () => {
      clearTimeout(_searchDebounce);
      _searchDebounce = setTimeout(() => {
        const query = searchInput.value.trim();
        if (query.length === 0) {
          showDefaultEmojis(resultsGrid);
        } else {
          const results = EmojiData.search(query, 36);
          renderEmojiGrid(resultsGrid, results);
        }
      }, 120);
    });

    // Click handler for emoji selection (delegated)
    picker.addEventListener('click', (e) => {
      const item = e.target.closest('.sticker-picker__item');
      if (!item) return;

      const emoji = item.dataset.emoji;
      _placingEmoji = emoji;
      addRecent(emoji);
      document.body.classList.add('placing-sticker');

      // Hide picker but keep placing mode active
      const pickerEl = document.getElementById('stickerPicker');
      pickerEl.classList.remove('visible');

      // Reset search for next open
      searchInput.value = '';
      showDefaultEmojis(resultsGrid);
      renderQuickAccess(quickSection);
    });
  }

  function renderQuickAccess(container) {
    container.textContent = '';
    const recents = getRecents();
    const emojis = recents.length > 0 ? recents : POPULAR_DEFAULTS;

    const label = document.createElement('div');
    label.className = 'sticker-picker__recent-label';
    label.textContent = recents.length > 0 ? 'Recent' : 'Popular';
    container.appendChild(label);

    const row = document.createElement('div');
    row.className = 'sticker-picker__quick-row';
    emojis.slice(0, 6).forEach(emoji => {
      const btn = document.createElement('button');
      btn.className = 'sticker-picker__item sticker-picker__item--quick';
      btn.dataset.emoji = emoji;
      btn.textContent = emoji;
      row.appendChild(btn);
    });
    container.appendChild(row);
  }

  function showDefaultEmojis(grid) {
    grid.textContent = '';
    const hint = document.createElement('div');
    hint.className = 'sticker-picker__empty';
    hint.textContent = 'Type to search 500+ emojis...';
    grid.appendChild(hint);
  }

  function renderEmojiGrid(container, emojis) {
    container.textContent = '';
    if (emojis.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sticker-picker__empty';
      empty.textContent = 'No emojis found';
      container.appendChild(empty);
      return;
    }
    emojis.forEach(emoji => {
      const btn = document.createElement('button');
      btn.className = 'sticker-picker__item';
      btn.dataset.emoji = emoji;
      btn.textContent = emoji;
      container.appendChild(btn);
    });
  }

  // renderRecents removed — replaced by renderQuickAccess above search

  function togglePicker(e, forceState) {
    const picker = document.getElementById('stickerPicker');
    const shouldShow = forceState !== undefined ? forceState : !picker.classList.contains('visible');
    picker.classList.toggle('visible', shouldShow);

    if (shouldShow) {
      // Focus search input when opening
      const input = picker.querySelector('.sticker-picker__search');
      if (input) setTimeout(() => input.focus(), 50);
      // Refresh quick-access row
      const quickSection = picker.querySelector('.sticker-picker__quick-section');
      if (quickSection) renderQuickAccess(quickSection);
    }

    if (!shouldShow && !_placingEmoji) {
      document.body.classList.remove('placing-sticker');
    }
  }

  // ── Placement ──

  function setupPlacementListener() {
    document.addEventListener('click', (e) => {
      if (!_placingEmoji) return;

      // Don't place on UI elements
      if (e.target.closest('.sticker-picker, .sticker-add-btn, .settings-panel, .settings-overlay, .name-modal')) return;

      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;

      const sticker = {
        id: crypto.randomUUID(),
        icon: _placingEmoji,
        placedBy: DataLayer.getUser() || 'Anonymous',
        placedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24*60*60*1000).toISOString(),
        persistent: false,
        x, y
      };

      DataLayer.addSticker(sticker);
      _placingEmoji = null;
      document.body.classList.remove('placing-sticker');
      renderStickers();
    });
  }

  // ── Render Stickers ──

  function renderStickers() {
    // Remove existing bubbles
    document.querySelectorAll('.sticker-bubble').forEach(el => el.remove());

    const stickers = DataLayer.loadStickers();
    const currentUser = DataLayer.getUser();
    const isAdmin = DataLayer.isAdmin(currentUser);

    stickers.forEach(sticker => {
      const el = document.createElement('div');
      el.className = 'sticker-bubble';
      el.dataset.id = sticker.id;
      el.style.left = (sticker.x * window.innerWidth) + 'px';
      el.style.top = (sticker.y * window.innerHeight) + 'px';
      el.textContent = sticker.icon;

      // Thought-bubble tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'sticker-bubble__tooltip';
      const timeAgo = formatTimeAgo(sticker.placedAt);
      const customText = sticker.tooltipText || '';
      if (customText) {
        // Show thought bubble with custom text
        const thought = document.createElement('div');
        thought.className = 'sticker-bubble__thought';
        thought.textContent = customText;
        el.appendChild(thought);
      }
      tooltip.textContent = sticker.icon + ' by ' + sticker.placedBy + ' \u00B7 ' + timeAgo;
      el.appendChild(tooltip);

      // Right-click context menu
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        _showStickerContextMenu(e.clientX, e.clientY, sticker, currentUser, isAdmin);
      });

      // Drag behavior
      el.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        _dragState = {
          el,
          id: sticker.id,
          offsetX: e.clientX - el.offsetLeft,
          offsetY: e.clientY - el.offsetTop
        };
      });

      document.body.appendChild(el);
    });
  }

  // ── Drag Handlers ──

  document.addEventListener('mousemove', (e) => {
    if (!_dragState) return;
    const x = e.clientX - _dragState.offsetX;
    const y = e.clientY - _dragState.offsetY;
    _dragState.el.style.left = x + 'px';
    _dragState.el.style.top = y + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!_dragState) return;
    const el = _dragState.el;
    const nx = parseInt(el.style.left) / window.innerWidth;
    const ny = parseInt(el.style.top) / window.innerHeight;
    DataLayer.updateStickerPosition(_dragState.id, nx, ny);
    _dragState = null;
  });

  // ── Sticker Context Menu ──

  let _ctxMenu = null;

  function _showStickerContextMenu(mx, my, sticker, currentUser, isAdmin) {
    _dismissCtxMenu();
    const menu = document.createElement('div');
    menu.className = 'sticker-ctx-menu';
    menu.style.left = mx + 'px';
    menu.style.top = my + 'px';

    // Add / edit thought bubble text
    const editItem = document.createElement('div');
    editItem.className = 'sticker-ctx-menu__item';
    editItem.textContent = sticker.tooltipText ? 'Edit thought bubble' : 'Add thought bubble';
    editItem.addEventListener('click', () => {
      _dismissCtxMenu();
      const text = prompt('Enter thought bubble text (max 15 chars):', sticker.tooltipText || '');
      if (text !== null) {
        sticker.tooltipText = text.trim().slice(0, 15);
        // Save to DataLayer
        const all = DataLayer.loadStickers();
        const target = all.find(s => s.id === sticker.id);
        if (target) {
          target.tooltipText = sticker.tooltipText;
          DataLayer.saveStickers(all);
        }
        renderStickers();
      }
    });
    menu.appendChild(editItem);

    // Remove sticker (owner or admin only)
    if (sticker.placedBy === currentUser || isAdmin) {
      const removeItem = document.createElement('div');
      removeItem.className = 'sticker-ctx-menu__item sticker-ctx-menu__item--danger';
      removeItem.textContent = 'Remove sticker';
      removeItem.addEventListener('click', () => {
        _dismissCtxMenu();
        DataLayer.removeSticker(sticker.id);
        renderStickers();
      });
      menu.appendChild(removeItem);
    }

    document.body.appendChild(menu);
    _ctxMenu = menu;

    // Dismiss on click elsewhere
    setTimeout(() => {
      document.addEventListener('click', _dismissCtxMenu, { once: true });
    }, 0);
  }

  function _dismissCtxMenu() {
    if (_ctxMenu) {
      _ctxMenu.remove();
      _ctxMenu = null;
    }
  }

  // ── Helpers ──

  function formatTimeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    return days + 'd ago';
  }

  // Reposition stickers on window resize (normalized coords)
  window.addEventListener('resize', () => {
    document.querySelectorAll('.sticker-bubble').forEach(el => {
      const sticker = DataLayer.loadStickers().find(s => s.id === el.dataset.id);
      if (sticker) {
        el.style.left = (sticker.x * window.innerWidth) + 'px';
        el.style.top = (sticker.y * window.innerHeight) + 'px';
      }
    });
  });

  return { init, renderStickers, renderPicker, togglePicker };
})();
