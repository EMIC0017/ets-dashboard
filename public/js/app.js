/* ─────────────────────────────────────────────
   app.js — Main Application
   Orchestrates data, rendering, and auto-refresh
   ───────────────────────────────────────────── */

const App = (() => {
  const REFRESH_INTERVAL = 15000; // 15 seconds

  async function init() {
    // Check if user has identified themselves
    const user = DataLayer.getUser();
    if (!user) {
      showNameModal();
      return; // init will be called again after name is set
    }

    // Load data and render
    await DataLayer.load();
    Settings.init();
    Stickers.init();
    initProfileButton();
    render();
    applyVisibility();

    // Start Slack presence polling (uses proxy when configured)
    if (typeof SlackStatus !== 'undefined') {
      SlackStatus.startPolling();
    }

    // Auto-refresh
    setInterval(async () => {
      await DataLayer.load();
      render();
      document.getElementById('lastUpdatedTime').textContent = 'Updated ' + new Date().toLocaleTimeString();
    }, REFRESH_INTERVAL);
  }

  // ── Name Modal ──

  function showNameModal() {
    const modal = document.getElementById('nameModal');
    modal.classList.remove('hidden');
    const input = document.getElementById('nameInput');
    input.focus();

    const submit = () => {
      const name = input.value.trim();
      if (!name) return;
      DataLayer.setUser(name);
      modal.classList.add('hidden');
      init(); // re-init with user set
    };

    document.getElementById('nameSubmit').addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
  }

  // ── Profile Button ──

  let _profileDropdown = null;

  function initProfileButton() {
    const btn = document.getElementById('profileBtn');
    if (!btn) return;
    updateProfileButtonFace(btn);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleProfileDropdown(btn);
    });
  }

  function updateProfileButtonFace(btn) {
    if (!btn) btn = document.getElementById('profileBtn');
    if (!btn) return;
    const profile = DataLayer.getUserProfile();
    btn.textContent = profile.statusIcon || '\uD83D\uDC64'; // 👤 default
  }

  function toggleProfileDropdown(anchorBtn) {
    if (_profileDropdown) { _closeProfileDropdown(); return; }

    const profile = DataLayer.getUserProfile();
    const userName = DataLayer.getUser() || 'Anonymous';

    const dd = document.createElement('div');
    dd.className = 'profile-dropdown';

    // Position below the button
    const rect = anchorBtn.getBoundingClientRect();
    dd.style.top = (rect.bottom + 8) + 'px';
    dd.style.right = (window.innerWidth - rect.right) + 'px';

    // Header with name
    const header = document.createElement('div');
    header.className = 'profile-dropdown__header';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'profile-dropdown__name';
    nameSpan.textContent = userName;
    header.appendChild(nameSpan);
    dd.appendChild(header);

    // Status Icon section
    const iconLabel = document.createElement('div');
    iconLabel.className = 'profile-dropdown__section-label';
    iconLabel.textContent = 'Status Icon';
    dd.appendChild(iconLabel);

    let _selectedIcon = profile.statusIcon || '';

    // Helper to select an icon and update all rows
    function _selectIcon(emoji) {
      _selectedIcon = emoji;
      dd.querySelectorAll('.profile-dropdown__icon-btn').forEach(b => {
        b.classList.toggle('profile-dropdown__icon-btn--active',
          emoji ? b.textContent === emoji : b.classList.contains('profile-dropdown__icon-btn--clear'));
      });
    }

    // Recent icons row (if any)
    const recentIcons = DataLayer.getRecentProfileIcons();
    if (recentIcons.length > 0) {
      const recentRow = document.createElement('div');
      recentRow.className = 'profile-dropdown__icon-row';
      recentRow.style.marginBottom = '4px';

      const recentLabel = document.createElement('span');
      recentLabel.style.cssText = 'font-size:9px;color:var(--text-muted);align-self:center;margin-right:2px;';
      recentLabel.textContent = 'Recent';
      recentRow.appendChild(recentLabel);

      recentIcons.forEach(emoji => {
        const btn = document.createElement('button');
        btn.className = 'profile-dropdown__icon-btn'
          + (emoji === profile.statusIcon ? ' profile-dropdown__icon-btn--active' : '');
        btn.textContent = emoji;
        btn.addEventListener('click', () => _selectIcon(emoji));
        recentRow.appendChild(btn);
      });
      dd.appendChild(recentRow);
    }

    const iconRow = document.createElement('div');
    iconRow.className = 'profile-dropdown__icon-row';

    // Quick-pick popular work status emojis
    const quickIcons = [
      '\uD83D\uDFE2', '\uD83D\uDD34', '\uD83D\uDCC5', '\uD83D\uDCF9', // 🟢🔴📅📹
      '\uD83C\uDFE0', '\uD83C\uDFA7', '\u2615', '\uD83D\uDCDE',       // 🏠🎧☕📞
      '\uD83D\uDE34', '\uD83D\uDEAB', '\u2708\uFE0F', '\uD83D\uDE97'  // 😴🚫✈️🚗
    ]; // 🟢🔴📅📹🏠🎧☕📞😴🚫✈️🚗

    // "Clear" button
    const clearBtn = document.createElement('button');
    clearBtn.className = 'profile-dropdown__icon-btn profile-dropdown__icon-btn--clear'
      + (!profile.statusIcon ? ' profile-dropdown__icon-btn--active' : '');
    clearBtn.textContent = 'None';
    clearBtn.addEventListener('click', () => _selectIcon(''));
    iconRow.appendChild(clearBtn);

    quickIcons.forEach(emoji => {
      const btn = document.createElement('button');
      btn.className = 'profile-dropdown__icon-btn'
        + (emoji === profile.statusIcon ? ' profile-dropdown__icon-btn--active' : '');
      btn.textContent = emoji;
      btn.addEventListener('click', () => _selectIcon(emoji));
      iconRow.appendChild(btn);
    });
    dd.appendChild(iconRow);

    // Custom icon via search
    const searchRow = document.createElement('div');
    searchRow.style.cssText = 'display:flex;gap:4px;align-items:center;';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'profile-dropdown__input';
    searchInput.placeholder = 'Search more icons...';
    searchInput.style.cssText = 'flex:1;height:28px;padding-right:8px;font-size:11px;';
    searchRow.appendChild(searchInput);
    dd.appendChild(searchRow);

    const searchResults = document.createElement('div');
    searchResults.className = 'profile-dropdown__icon-row';
    searchResults.style.display = 'none';
    dd.appendChild(searchResults);

    let _searchDebounce = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(_searchDebounce);
      _searchDebounce = setTimeout(() => {
        const q = searchInput.value.trim();
        if (!q) { searchResults.style.display = 'none'; return; }
        searchResults.style.display = 'flex';
        searchResults.textContent = '';
        const results = (typeof EmojiData !== 'undefined') ? EmojiData.search(q, 16) : [];
        results.forEach(emoji => {
          const btn = document.createElement('button');
          btn.className = 'profile-dropdown__icon-btn';
          btn.textContent = emoji;
          btn.addEventListener('click', () => _selectIcon(emoji));
          searchResults.appendChild(btn);
        });
      }, 150);
    });
    searchInput.addEventListener('keydown', (e) => e.stopPropagation());

    // Tooltip text section
    const tooltipLabel = document.createElement('div');
    tooltipLabel.className = 'profile-dropdown__section-label';
    tooltipLabel.textContent = 'Status Text';
    dd.appendChild(tooltipLabel);

    // Recent texts as clickable chips
    const recentTexts = DataLayer.getRecentProfileTexts();
    if (recentTexts.length > 0) {
      const textsRow = document.createElement('div');
      textsRow.className = 'profile-dropdown__recent-texts';
      recentTexts.forEach(text => {
        const chip = document.createElement('button');
        chip.className = 'profile-dropdown__recent-chip';
        chip.textContent = text;
        chip.title = text;
        chip.addEventListener('click', () => {
          tooltipInput.value = text;
          charCount.textContent = text.length + '/15';
        });
        textsRow.appendChild(chip);
      });
      dd.appendChild(textsRow);
    }

    const inputWrap = document.createElement('div');
    inputWrap.className = 'profile-dropdown__input-wrap';

    const tooltipInput = document.createElement('input');
    tooltipInput.type = 'text';
    tooltipInput.className = 'profile-dropdown__input';
    tooltipInput.value = profile.tooltipText || '';
    tooltipInput.placeholder = 'e.g. In meetings...';
    tooltipInput.maxLength = 15;
    inputWrap.appendChild(tooltipInput);

    const charCount = document.createElement('span');
    charCount.className = 'profile-dropdown__charcount';
    charCount.textContent = (profile.tooltipText || '').length + '/15';
    inputWrap.appendChild(charCount);

    tooltipInput.addEventListener('input', () => {
      charCount.textContent = tooltipInput.value.length + '/15';
    });
    tooltipInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') saveBtn.click();
      if (e.key === 'Escape') _closeProfileDropdown();
    });
    dd.appendChild(inputWrap);

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'profile-dropdown__save';
    saveBtn.textContent = 'Save Profile';
    saveBtn.addEventListener('click', () => {
      const newProfile = {
        statusIcon: _selectedIcon,
        tooltipText: tooltipInput.value.trim().slice(0, 15)
      };
      DataLayer.saveUserProfile(newProfile);
      updateProfileButtonFace();
      _closeProfileDropdown();
      render();
    });
    dd.appendChild(saveBtn);

    document.body.appendChild(dd);
    _profileDropdown = dd;

    // Animate in
    requestAnimationFrame(() => dd.classList.add('visible'));

    // Click outside to close
    setTimeout(() => {
      document.addEventListener('mousedown', function _outsideProfileClick(e) {
        if (dd.contains(e.target) || e.target === anchorBtn) return;
        document.removeEventListener('mousedown', _outsideProfileClick);
        _closeProfileDropdown();
      });
    }, 0);
  }

  function _closeProfileDropdown() {
    if (_profileDropdown) {
      _profileDropdown.remove();
      _profileDropdown = null;
    }
  }

  // ── Render All ──

  function render() {
    renderBanner();
    renderWeekLabel();
    renderPods();
    renderBulletin();
    renderSpotlight();
    renderOnCall();
    renderTeamStatus();
    renderCertifiedApps();
    Stickers.renderStickers();
  }

  // ── Banner ──

  function renderBanner() {
    const announcements = DataLayer.getAnnouncements().filter(a => a.active);
    const banner = document.getElementById('banner');
    const text = document.getElementById('bannerText');

    if (announcements.length === 0 || Settings.isBannerDismissed()) {
      banner.classList.add('hidden');
      return;
    }

    banner.classList.remove('hidden');
    const a = announcements[0];
    text.textContent = a.text;

    if (a.link) {
      text.textContent = '';
      const link = document.createElement('a');
      link.href = a.link;
      link.target = '_blank';
      link.textContent = a.text;
      text.appendChild(link);
    }

    // Apply custom banner color
    const bannerColor = DataLayer.getBannerColor();
    if (bannerColor) {
      banner.style.setProperty('--banner-color', bannerColor);
      banner.style.background = bannerColor;
    }

    // Ticker scroll mode
    const shouldScroll = localStorage.getItem('ets_banner_scroll') === 'true';
    banner.classList.toggle('banner--ticker', shouldScroll);
    if (shouldScroll && !text.querySelector('.banner__ticker-text')) {
      // Move existing children into a scrolling wrapper
      const ticker = document.createElement('span');
      ticker.className = 'banner__ticker-text';
      while (text.firstChild) {
        ticker.appendChild(text.firstChild);
      }
      text.appendChild(ticker);
    } else if (!shouldScroll && text.querySelector('.banner__ticker-text')) {
      // Unwrap ticker back to normal
      const ticker = text.querySelector('.banner__ticker-text');
      while (ticker.firstChild) {
        text.appendChild(ticker.firstChild);
      }
      ticker.remove();
    }
  }

  // ── Week Ending Label ──

  function renderWeekLabel() {
    const el = document.getElementById('podsWeek');
    // Calculate the upcoming Friday (end of work week)
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 5=Fri
    const daysUntilFri = (5 - day + 7) % 7 || 7; // if already Fri, show this Fri
    const friday = new Date(now);
    // If today is Friday, use today
    if (day === 5) {
      friday.setDate(now.getDate());
    } else {
      friday.setDate(now.getDate() + daysUntilFri);
    }
    const dateStr = friday.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric'
    });
    el.textContent = 'Week ending: ' + dateStr;
  }

  // ── Pod Tiles ──

  function renderPods() {
    const grid = document.getElementById('podsGrid');
    const pods = DataLayer.getPods();
    const customColors = Settings.getPrefs().customPodColors || {};

    grid.textContent = '';

    pods.forEach(pod => {
      const color = customColors[pod.shortName] || pod.color;

      const card = document.createElement('div');
      card.className = 'pod-card';
      card.style.setProperty('--pod-color', color);
      card.style.borderLeftColor = color;
      card.dataset.podName = pod.shortName;
      card.addEventListener('click', () => {
        window.location.href = 'pod.html?id=' + pod.id;
      });

      // Card-level tooltip for compact mode (stats summary)
      const stats = pod.stats || {};
      card.title = pod.fullName
        + '\nResources: ' + (stats.teamSize || '?')
        + '  |  Resp SLA: ' + (stats.responseSLA || '?') + '%'
        + '  |  Res SLA: ' + (stats.resolutionSLA || '?') + '%'
        + '\nBreaches: ' + (stats.totalBreaches || 0)
        + '  |  Escalations: ' + (stats.totalEscalations || 0);

      // Background icon — use pod settings override or default emoji
      const podSettings = DataLayer.getPodSettings ? DataLayer.getPodSettings(pod.shortName) : {};
      const customIcon = podSettings.bgIcon || pod.icon;
      if (customIcon) {
        const bgIcon = document.createElement('div');
        bgIcon.className = 'pod-card__bg-icon';
        if (customIcon.startsWith('http') || customIcon.startsWith('/') || customIcon.startsWith('data:')) {
          const img = document.createElement('img');
          img.src = customIcon;
          img.alt = '';
          bgIcon.appendChild(img);
        } else {
          // Render emoji to canvas → monochromatic tint with pod color
          _tintEmoji(customIcon, color).then(dataUrl => {
            if (dataUrl) {
              const img = document.createElement('img');
              img.src = dataUrl;
              img.alt = '';
              bgIcon.appendChild(img);
            } else {
              bgIcon.textContent = customIcon;
            }
          });
        }
        card.appendChild(bgIcon);
      }

      // Header row: name + team size
      const header = document.createElement('div');
      header.className = 'pod-card__header';

      const name = document.createElement('div');
      name.className = 'pod-card__name';
      name.textContent = pod.shortName;
      header.appendChild(name);

      card.appendChild(header);

      const fullname = document.createElement('div');
      fullname.className = 'pod-card__fullname';
      fullname.textContent = pod.fullName;
      card.appendChild(fullname);

      // Breach & Escalation indicators (below name)
      const breachCount = pod.stats?.totalBreaches || 0;
      const escalationCount = pod.stats?.totalEscalations || 0;
      if (breachCount > 0 || escalationCount > 0) {
        const indicators = document.createElement('div');
        indicators.className = 'pod-card__indicators';
        for (let i = 0; i < breachCount; i++) {
          const x = document.createElement('span');
          x.className = 'pod-card__breach';
          x.textContent = '\u2715';
          x.title = 'SLA Breach';
          indicators.appendChild(x);
        }
        for (let i = 0; i < escalationCount; i++) {
          const bang = document.createElement('span');
          bang.className = 'pod-card__escalation';
          bang.textContent = '!';
          bang.title = 'Escalation';
          indicators.appendChild(bang);
        }
        card.appendChild(indicators);
      }

      // Sparkline chart area
      const chartWrap = document.createElement('div');
      chartWrap.className = 'pod-card__chart';

      const incoming = pod.stats?.weeklyIncoming || [];
      const throughput = pod.stats?.weeklyThroughput || [];
      const aht = pod.stats?.weeklyAHT || [];
      const weeks = pod.stats?.weeks || [];
      const responseSLA = pod.stats?.responseSLA;
      const resolutionSLA = pod.stats?.resolutionSLA;
      const totalBreaches = pod.stats?.totalBreaches;
      const totalEscalations = pod.stats?.totalEscalations;

      if (incoming.length > 0) {
        const svg = buildSparklineSVG(incoming, aht, color);
        chartWrap.appendChild(svg);

        // Hover tooltip interaction
        chartWrap.addEventListener('mousemove', (e) => {
          const rect = chartWrap.getBoundingClientRect();
          const xRatio = (e.clientX - rect.left) / rect.width;
          const idx = Math.min(Math.floor(xRatio * incoming.length), incoming.length - 1);
          if (idx < 0) return;
          showChartTooltip(
            e.clientX, e.clientY,
            weeks[idx] || 'Week ' + (idx + 1),
            incoming[idx],
            throughput[idx],
            aht[idx],
            responseSLA,
            resolutionSLA,
            totalBreaches,
            totalEscalations,
            color
          );
        });
        chartWrap.addEventListener('mouseleave', hideChartTooltip);
      }

      card.appendChild(chartWrap);

      // SLA overlay — top-right of card
      if (responseSLA !== undefined || resolutionSLA !== undefined) {
        const slaWrap = document.createElement('div');
        slaWrap.className = 'pod-card__sla';

        if (responseSLA !== undefined) {
          const rVal = document.createElement('div');
          rVal.className = 'pod-sla__value ' + slaColorClass(responseSLA);
          rVal.textContent = responseSLA + '%';
          slaWrap.appendChild(rVal);
        }
        if (resolutionSLA !== undefined) {
          const resVal = document.createElement('div');
          resVal.className = 'pod-sla__value ' + slaColorClass(resolutionSLA);
          resVal.textContent = resolutionSLA + '%';
          slaWrap.appendChild(resVal);
        }

        card.appendChild(slaWrap);
      }

      grid.appendChild(card);
    });
  }

  // ── Bulletin ──

  function renderBulletin() {
    const list = document.getElementById('bulletinList');
    const bulletin = DataLayer.getBulletin()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const currentUser = DataLayer.getUser();
    const isAdmin = DataLayer.isAdmin(currentUser);

    list.textContent = '';

    // Wire up add button
    const addBtn = document.getElementById('bulletinAddBtn');
    // Replace to clear old listeners
    const newAddBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newAddBtn, addBtn);
    newAddBtn.addEventListener('click', () => toggleBulletinForm());

    if (bulletin.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No news \u2014 must be a good day!';
      list.appendChild(empty);
      return;
    }

    bulletin.forEach(b => {
      const item = document.createElement('div');
      item.className = 'bulletin-item';

      // Highlighted background
      if (b.highlight) {
        item.classList.add('bulletin-item--highlighted');
        item.style.background = b.highlight;
      }

      // Title row with delete button
      const titleRow = document.createElement('div');
      titleRow.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:8px;';

      const title = document.createElement('div');
      title.className = 'bulletin-item__title';
      title.style.flex = '1';
      if (b.textColor) title.style.color = b.textColor;
      title.textContent = b.title;
      titleRow.appendChild(title);

      // Delete button (author or admin)
      const canDelete = isAdmin || (b.author && b.author.toLowerCase() === (currentUser || '').toLowerCase());
      if (canDelete) {
        const delBtn = document.createElement('button');
        delBtn.className = 'bulletin-item__delete';
        delBtn.textContent = '\u2715';
        delBtn.title = 'Remove post';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          DataLayer.removeBulletinItem(b.id);
          renderBulletin();
        });
        titleRow.appendChild(delBtn);
      }

      item.appendChild(titleRow);

      const body = document.createElement('div');
      body.className = 'bulletin-item__body';
      if (b.textColor) {
        body.style.color = b.textColor;
        body.style.opacity = '0.8';
      } else {
        body.style.color = 'var(--text-secondary)';
      }
      body.textContent = b.body;
      item.appendChild(body);

      const meta = document.createElement('div');
      meta.className = 'bulletin-item__time';
      const timeStr = new Date(b.createdAt).toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
      });
      meta.textContent = (b.author ? b.author + ' \u00B7 ' : '') + timeStr;
      item.appendChild(meta);

      list.appendChild(item);
    });
  }

  // ── Bulletin Add Form (Modal Overlay) ──

  let _bulletinModal = null;

  function toggleBulletinForm() {
    // If modal already open, close it
    if (_bulletinModal) { _closeBulletinModal(); return; }

    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'bulletin-modal-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) _closeBulletinModal();
    });

    // Modal panel
    const panel = document.createElement('div');
    panel.className = 'bulletin-modal';

    const heading = document.createElement('div');
    heading.className = 'bulletin-modal__heading';
    heading.textContent = 'New Bulletin Post';
    panel.appendChild(heading);

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'bulletin-add-form__input';
    titleInput.placeholder = 'Title (e.g. \uD83D\uDE80 New Feature Shipped!)';
    panel.appendChild(titleInput);

    const bodyInput = document.createElement('textarea');
    bodyInput.className = 'bulletin-add-form__textarea';
    bodyInput.placeholder = 'Details...';
    bodyInput.rows = 3;
    panel.appendChild(bodyInput);

    // Color row
    const colorRow = document.createElement('div');
    colorRow.className = 'bulletin-add-form__colors';

    const colorPresets = [
      { label: 'None', bg: null, text: null },
      { label: '\uD83D\uDFE6', bg: '#DBEAFE', text: '#1E40AF' },
      { label: '\uD83D\uDFE8', bg: '#FEF3C7', text: '#92400E' },
      { label: '\uD83D\uDFE2', bg: '#DCFCE7', text: '#166534' },
      { label: '\uD83D\uDFE0', bg: '#FFF7ED', text: '#9A3412' },
      { label: '\uD83D\uDFE3', bg: '#F3E8FF', text: '#6B21A8' }
    ];

    let selectedColor = colorPresets[0];
    colorPresets.forEach((preset, i) => {
      const btn = document.createElement('button');
      btn.className = 'bulletin-color-btn' + (i === 0 ? ' bulletin-color-btn--active' : '');
      if (preset.bg) {
        btn.style.background = preset.bg;
        btn.style.color = preset.text;
      }
      btn.textContent = preset.label;
      btn.addEventListener('click', () => {
        selectedColor = preset;
        colorRow.querySelectorAll('.bulletin-color-btn').forEach(b => b.classList.remove('bulletin-color-btn--active'));
        btn.classList.add('bulletin-color-btn--active');
      });
      colorRow.appendChild(btn);
    });
    panel.appendChild(colorRow);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'bulletin-add-form__actions';

    const postBtn = document.createElement('button');
    postBtn.className = 'bulletin-add-form__post';
    postBtn.textContent = 'Post';
    postBtn.addEventListener('click', () => {
      const titleVal = titleInput.value.trim();
      const bodyVal = bodyInput.value.trim();
      if (!titleVal) { titleInput.style.borderColor = '#EF4444'; return; }
      DataLayer.addBulletinItem({
        title: titleVal,
        body: bodyVal,
        highlight: selectedColor.bg,
        textColor: selectedColor.text
      });
      _closeBulletinModal();
      renderBulletin();
    });
    actions.appendChild(postBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'bulletin-add-form__cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', _closeBulletinModal);
    actions.appendChild(cancelBtn);

    panel.appendChild(actions);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    _bulletinModal = overlay;

    // Animate in
    requestAnimationFrame(() => overlay.classList.add('visible'));
    titleInput.focus();

    // Escape to close
    overlay._onKey = (e) => { if (e.key === 'Escape') _closeBulletinModal(); };
    document.addEventListener('keydown', overlay._onKey);
  }

  function _closeBulletinModal() {
    if (_bulletinModal) {
      document.removeEventListener('keydown', _bulletinModal._onKey);
      _bulletinModal.remove();
      _bulletinModal = null;
    }
  }

  // ── Spotlight (Tip of the Week / Team Member of the Week) ──

  function renderSpotlight() {
    const area = document.getElementById('spotlightArea');
    const spotlight = DataLayer.getSpotlight();
    area.textContent = '';

    if (!spotlight) {
      area.style.display = 'none';
      return;
    }

    area.style.display = '';
    const wrap = document.createElement('div');
    wrap.className = 'spotlight';

    // Avatar
    if (spotlight.avatar) {
      const img = document.createElement('img');
      img.className = 'spotlight__avatar';
      img.src = spotlight.avatar;
      img.alt = spotlight.name || 'Spotlight';
      wrap.appendChild(img);
    }

    // Content
    const content = document.createElement('div');
    content.className = 'spotlight__content';

    const label = document.createElement('div');
    label.className = 'spotlight__label';
    label.textContent = spotlight.title || 'Spotlight';
    content.appendChild(label);

    if (spotlight.name) {
      const nameRow = document.createElement('div');
      const nameSpan = document.createElement('span');
      nameSpan.className = 'spotlight__name';
      nameSpan.textContent = spotlight.name;
      nameRow.appendChild(nameSpan);

      if (spotlight.pod) {
        const pods = DataLayer.getPods();
        const customColors = Settings.getPrefs().customPodColors || {};
        const pod = pods.find(p => p.shortName === spotlight.pod);
        const podColor = customColors[spotlight.pod] || (pod ? pod.color : 'var(--text-muted)');

        const podSpan = document.createElement('span');
        podSpan.className = 'spotlight__pod';
        podSpan.style.color = podColor;
        podSpan.textContent = spotlight.pod;
        nameRow.appendChild(podSpan);
      }
      content.appendChild(nameRow);
    }

    if (spotlight.message) {
      const msg = document.createElement('div');
      msg.className = 'spotlight__message';
      msg.textContent = spotlight.message;
      content.appendChild(msg);
    }

    wrap.appendChild(content);

    // Edit button (hover-visible)
    const editBtn = document.createElement('button');
    editBtn.className = 'spotlight__edit';
    editBtn.title = 'Edit Team Member of the Week';
    editBtn.textContent = '\u270F\uFE0F';
    editBtn.addEventListener('click', (e) => { e.stopPropagation(); openSpotlightEditor(); });
    wrap.appendChild(editBtn);

    area.appendChild(wrap);
  }

  // ── Spotlight Editor Modal ──

  let _spotlightModal = null;

  function openSpotlightEditor() {
    if (_spotlightModal) { _closeSpotlightModal(); return; }

    const spotlight = DataLayer.getSpotlight() || {};
    const members = DataLayer.getTeamMembers();
    const pods = DataLayer.getPods();

    // State
    let selName = spotlight.name || '';
    let selPod = spotlight.pod || '';
    let selAvatar = spotlight.avatar || '';
    let selMessage = spotlight.message || '';
    let customUrl = '';

    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'bulletin-modal-overlay';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) _closeSpotlightModal(); });

    // Panel
    const panel = document.createElement('div');
    panel.className = 'bulletin-modal';
    panel.style.maxWidth = '380px';

    const heading = document.createElement('div');
    heading.className = 'bulletin-modal__heading';
    heading.textContent = 'Edit Team Member of the Week';
    panel.appendChild(heading);

    // Avatar preview
    const avatarRow = document.createElement('div');
    avatarRow.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:10px;';
    const avatarImg = document.createElement('img');
    avatarImg.style.cssText = 'width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid var(--border);background:var(--bg);';
    avatarImg.src = selAvatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default';
    const avatarInfo = document.createElement('div');
    avatarInfo.style.cssText = 'flex:1;min-width:0;';
    avatarRow.appendChild(avatarImg);
    avatarRow.appendChild(avatarInfo);
    panel.appendChild(avatarRow);

    // Team member dropdown
    const memberLabel = document.createElement('label');
    memberLabel.className = 'spotlight-modal__label';
    memberLabel.textContent = 'Team Member';
    avatarInfo.appendChild(memberLabel);

    const memberSelect = document.createElement('select');
    memberSelect.className = 'bulletin-add-form__input';
    memberSelect.style.width = '100%';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '— Select a team member —';
    memberSelect.appendChild(defaultOpt);

    members.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.name;
      opt.textContent = m.name + (m.pod ? ' (' + m.pod + ')' : '');
      if (m.name === selName) opt.selected = true;
      memberSelect.appendChild(opt);
    });

    memberSelect.addEventListener('change', () => {
      const m = members.find(x => x.name === memberSelect.value);
      if (m) {
        selName = m.name;
        selPod = m.pod || '';
        podSelect.value = selPod;
        if (!useCustomUrl) {
          selAvatar = dicebearUrl(activeStyle, m.name);
          avatarImg.src = selAvatar;
        }
        // Refresh avatar style grid with new name seed
        if (typeof refreshStyleGrid === 'function') refreshStyleGrid();
      }
    });
    avatarInfo.appendChild(memberSelect);

    // Pod dropdown
    const podLabel = document.createElement('label');
    podLabel.className = 'spotlight-modal__label';
    podLabel.textContent = 'Pod';
    panel.appendChild(podLabel);

    const podSelect = document.createElement('select');
    podSelect.className = 'bulletin-add-form__input';
    podSelect.style.width = '100%';

    // Collect all unique groups from team members + pods
    const podNames = pods.map(p => p.shortName);
    const extraGroups = [...new Set(members.map(m => m.pod).filter(g => g && !podNames.includes(g)))];

    pods.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.shortName;
      opt.textContent = p.shortName + ' — ' + p.fullName;
      if (p.shortName === selPod) opt.selected = true;
      podSelect.appendChild(opt);
    });
    extraGroups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      if (g === selPod) opt.selected = true;
      podSelect.appendChild(opt);
    });
    podSelect.addEventListener('change', () => { selPod = podSelect.value; });
    panel.appendChild(podSelect);

    // ── Photo Source Picker ──
    const photoLabel = document.createElement('label');
    photoLabel.className = 'spotlight-modal__label';
    photoLabel.textContent = 'Photo';
    panel.appendChild(photoLabel);

    // Avatar style options
    const AVATAR_STYLES = [
      { id: 'avataaars', label: 'Avataaars' },
      { id: 'bottts', label: 'Bots' },
      { id: 'lorelei', label: 'Lorelei' },
      { id: 'notionists', label: 'Notionists' },
      { id: 'thumbs', label: 'Thumbs' },
      { id: 'fun-emoji', label: 'Emoji' },
      { id: 'pixel-art', label: 'Pixel' },
      { id: 'adventurer', label: 'Adventure' }
    ];

    function dicebearUrl(style, name) {
      const seed = encodeURIComponent((name || 'default').replace(/\s+/g, ''));
      return 'https://api.dicebear.com/7.x/' + style + '/svg?seed=' + seed;
    }

    // Detect current style from existing avatar URL
    let activeStyle = 'avataaars';
    let useCustomUrl = false;
    if (selAvatar) {
      const styleMatch = selAvatar.match(/dicebear\.com\/7\.x\/([^/]+)\//);
      if (styleMatch) {
        activeStyle = styleMatch[1];
      } else if (!selAvatar.includes('dicebear.com')) {
        useCustomUrl = true;
        customUrl = selAvatar;
      }
    }

    // Style grid — clickable avatar previews
    const styleGrid = document.createElement('div');
    styleGrid.className = 'spotlight-avatar-grid';

    function refreshStyleGrid() {
      styleGrid.textContent = '';
      AVATAR_STYLES.forEach(s => {
        const btn = document.createElement('button');
        btn.className = 'spotlight-avatar-option' + (!useCustomUrl && s.id === activeStyle ? ' spotlight-avatar-option--active' : '');
        btn.title = s.label;
        const img = document.createElement('img');
        img.src = dicebearUrl(s.id, selName);
        img.alt = s.label;
        img.style.cssText = 'width:100%;height:100%;border-radius:50%;';
        btn.appendChild(img);
        btn.addEventListener('click', () => {
          activeStyle = s.id;
          useCustomUrl = false;
          selAvatar = dicebearUrl(s.id, selName);
          avatarImg.src = selAvatar;
          urlInput.value = '';
          customUrl = '';
          refreshStyleGrid();
        });
        styleGrid.appendChild(btn);
      });

      // "URL" option as last item
      const urlBtn = document.createElement('button');
      urlBtn.className = 'spotlight-avatar-option spotlight-avatar-option--url' + (useCustomUrl ? ' spotlight-avatar-option--active' : '');
      urlBtn.title = 'External image URL';
      urlBtn.textContent = '🔗';
      urlBtn.addEventListener('click', () => {
        useCustomUrl = true;
        refreshStyleGrid();
        urlInput.style.display = '';
        urlInput.focus();
      });
      styleGrid.appendChild(urlBtn);
    }

    refreshStyleGrid();
    panel.appendChild(styleGrid);

    // External URL input (hidden unless "URL" mode is active)
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.className = 'bulletin-add-form__input';
    urlInput.placeholder = 'https://example.com/photo.jpg';
    urlInput.value = customUrl;
    urlInput.style.display = useCustomUrl ? '' : 'none';
    urlInput.style.marginTop = '6px';
    urlInput.addEventListener('input', () => {
      customUrl = urlInput.value.trim();
      if (customUrl) {
        useCustomUrl = true;
        selAvatar = customUrl;
        avatarImg.src = customUrl;
        refreshStyleGrid();
      } else {
        useCustomUrl = false;
        selAvatar = dicebearUrl(activeStyle, selName);
        avatarImg.src = selAvatar;
        refreshStyleGrid();
      }
    });
    panel.appendChild(urlInput);

    // Achievement message
    const msgLabel = document.createElement('label');
    msgLabel.className = 'spotlight-modal__label';
    msgLabel.textContent = 'Achievement';
    panel.appendChild(msgLabel);

    const msgInput = document.createElement('textarea');
    msgInput.className = 'bulletin-add-form__textarea';
    msgInput.placeholder = 'What did they accomplish?';
    msgInput.rows = 3;
    msgInput.maxLength = 200;
    msgInput.value = selMessage;
    msgInput.addEventListener('input', () => { selMessage = msgInput.value; });
    panel.appendChild(msgInput);

    // Character count
    const charCount = document.createElement('div');
    charCount.style.cssText = 'font-size:10px;color:var(--text-muted);text-align:right;margin-top:-4px;';
    charCount.textContent = selMessage.length + '/200';
    msgInput.addEventListener('input', () => { charCount.textContent = msgInput.value.length + '/200'; });
    panel.appendChild(charCount);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'bulletin-add-form__actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'bulletin-add-form__post';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      if (!selName) { memberSelect.style.borderColor = '#EF4444'; return; }
      DataLayer.saveSpotlight({
        type: 'teamMember',
        title: 'Team Member of the Week',
        name: selName,
        pod: selPod,
        avatar: selAvatar,
        message: selMessage
      });
      _closeSpotlightModal();
      renderSpotlight();
    });
    actions.appendChild(saveBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'bulletin-add-form__cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', _closeSpotlightModal);
    actions.appendChild(cancelBtn);

    panel.appendChild(actions);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    _spotlightModal = overlay;

    // Escape key
    _spotlightModal._onKey = (e) => { if (e.key === 'Escape') _closeSpotlightModal(); };
    document.addEventListener('keydown', _spotlightModal._onKey);

    requestAnimationFrame(() => overlay.classList.add('visible'));
  }

  function _closeSpotlightModal() {
    if (_spotlightModal) {
      document.removeEventListener('keydown', _spotlightModal._onKey);
      _spotlightModal.remove();
      _spotlightModal = null;
    }
  }

  // ── On-Call ──

  function renderOnCall() {
    const bar = document.getElementById('onCallBar');
    const onCall = DataLayer.getOnCall();
    bar.textContent = '';

    if (!onCall || !onCall.name) {
      bar.style.display = 'none';
      return;
    }

    bar.style.display = '';

    // ── Row 1: primary on-call ──
    const row1 = document.createElement('div');
    row1.className = 'on-call-bar__row';

    const icon = document.createElement('span');
    icon.className = 'on-call-bar__icon';
    icon.textContent = '\uD83D\uDCDF'; // 📟 pager
    row1.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'on-call-bar__label';
    const link = document.createElement('a');
    link.href = onCall.link || '#';
    link.target = '_blank';
    link.textContent = 'On-Call Team Member:';
    label.appendChild(link);
    row1.appendChild(label);

    // Incident status emoji (after label, before name)
    const statusEmoji = document.createElement('span');
    statusEmoji.style.fontSize = '14px';
    statusEmoji.style.marginLeft = 'auto';
    statusEmoji.textContent = onCall.inIncident ? '\uD83D\uDE1F' : '\uD83D\uDE0A'; // 😟 or 😊
    statusEmoji.title = onCall.inIncident ? 'In Incident' : 'Idle \u2014 No Active Incidents';
    row1.appendChild(statusEmoji);

    const name = document.createElement('span');
    name.className = 'on-call-bar__name';
    name.style.marginLeft = '6px';
    // Abbreviate: "Eric Morin" -> "Eric M."
    const parts = onCall.name.split(' ');
    name.textContent = parts.length > 1 ? parts[0] + ' ' + parts[parts.length - 1][0] + '.' : onCall.name;

    // If in incident, add visual urgency
    if (onCall.inIncident) {
      name.style.color = '#EF4444';
      bar.style.borderLeft = '3px solid #EF4444';
    }

    row1.appendChild(name);
    bar.appendChild(row1);

    // ── Row 2: night shift / after-hours on-call ──
    const afterHours = onCall.afterHours;
    if (afterHours && afterHours.name) {
      const row2 = document.createElement('div');
      row2.className = 'on-call-bar__row';

      const nightIcon = document.createElement('span');
      nightIcon.className = 'on-call-bar__icon';
      nightIcon.textContent = '\uD83C\uDF19'; // 🌙
      row2.appendChild(nightIcon);

      const nightLabel = document.createElement('span');
      nightLabel.className = 'on-call-bar__label';
      if (afterHours.calendarUrl) {
        const nightLink = document.createElement('a');
        nightLink.href = afterHours.calendarUrl;
        nightLink.target = '_blank';
        nightLink.textContent = 'Night Shift:';
        nightLabel.appendChild(nightLink);
      } else {
        nightLabel.textContent = 'Night Shift:';
      }
      row2.appendChild(nightLabel);

      const nightName = document.createElement('span');
      nightName.className = 'on-call-bar__name';
      nightName.style.marginLeft = 'auto';
      const nightParts = afterHours.name.split(' ');
      nightName.textContent = nightParts.length > 1
        ? nightParts[0] + ' ' + nightParts[nightParts.length - 1][0] + '.'
        : afterHours.name;
      row2.appendChild(nightName);

      bar.appendChild(row2);
    }
  }

  // ── Team Status ──

  function renderTeamStatus() {
    const list = document.getElementById('teamList');
    const members = DataLayer.getTeamMembers();
    const pods = DataLayer.getPods();
    const customColors = Settings.getPrefs().customPodColors || {};

    // Build pod color lookup
    const podColorMap = {};
    pods.forEach(p => {
      podColorMap[p.shortName] = customColors[p.shortName] || p.color;
    });

    // Separate management from pod members
    const mgmt = members.filter(m => m.pod === 'Management');
    const podMembers = members.filter(m => m.pod !== 'Management');

    // Sort pod members based on preference (default: pod)
    const sortMode = Settings.getPrefs().teamSortMode || 'pod';
    const podOrder = pods.map(p => p.shortName);
    const sorted = [...podMembers].sort((a, b) => {
      if (sortMode === 'pod') {
        const podDiff = podOrder.indexOf(a.pod) - podOrder.indexOf(b.pod);
        if (podDiff !== 0) return podDiff;
        return a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });

    list.textContent = '';

    if (mgmt.length === 0 && sorted.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.style.gridColumn = '1 / -1';
      empty.textContent = 'No team members found';
      list.appendChild(empty);
      return;
    }

    // ── Render Management tier first ──
    if (mgmt.length > 0) {
      const divider = document.createElement('div');
      divider.className = 'member-pod-divider member-pod-divider--mgmt';
      divider.textContent = 'Management';
      list.appendChild(divider);

      mgmt.forEach(m => {
        list.appendChild(buildMemberRow(m, null));
      });
    }

    // ── Render pod members ──
    let lastPod = null;
    sorted.forEach(m => {
      if (sortMode === 'pod' && m.pod !== lastPod) {
        const divider = document.createElement('div');
        divider.className = 'member-pod-divider';
        divider.style.color = podColorMap[m.pod] || 'var(--text-muted)';
        divider.style.borderBottomColor = podColorMap[m.pod] || 'var(--border)';
        divider.textContent = m.pod;
        list.appendChild(divider);
        lastPod = m.pod;
      }

      list.appendChild(buildMemberRow(m, podColorMap));
    });
  }

  // ── Build a single member row ──
  function buildMemberRow(m, podColorMap) {
      const row = document.createElement('div');
      row.className = 'member-row';

      const dot = document.createElement('div');
      dot.className = 'member-dot member-dot--' + m.status;
      row.appendChild(dot);

      const name = document.createElement('span');
      name.className = 'member-name';
      // Managers get black text, everyone else gets pod color
      if (m.pod === 'Management') {
        name.classList.add('member-name--leader');
      } else {
        name.style.color = (podColorMap && podColorMap[m.pod]) || 'var(--text-primary)';
      }
      // Abbreviate: "Eric Morin" → "Eric M."
      const nameParts = m.name.split(' ');
      name.textContent = nameParts.length > 1
        ? nameParts[0] + ' ' + nameParts[nameParts.length - 1][0] + '.'
        : m.name;
      row.appendChild(name);

      // Status icon — visible to everyone after their name.
      // For the current user, pull from localStorage profile; for others, from Supabase status fields.
      const currentUser = DataLayer.getUser();
      const isCurrentUser = currentUser && m.name.toLowerCase().trim() === currentUser.toLowerCase().trim();
      let displayIcon = m.statusEmoji || '';
      if (isCurrentUser) {
        const profile = DataLayer.getUserProfile();
        displayIcon = profile.statusIcon || m.statusEmoji || '';
      }
      if (displayIcon) {
        const iconEl = document.createElement('span');
        iconEl.className = 'member-status-icon';
        iconEl.textContent = displayIcon;
        row.appendChild(iconEl);
      }

      // Hover tooltip
      row.addEventListener('mouseenter', (e) => showMemberTooltip(e.clientX, e.clientY, m));
      row.addEventListener('mousemove',  (e) => moveMemberTooltip(e.clientX, e.clientY));
      row.addEventListener('mouseleave', hideMemberTooltip);

      // Click → open Slack DM (slack:// deep-link launches desktop app)
      if (m.slackId) {
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
          window.open('slack://user?team=T02Q7DX34&id=' + m.slackId, '_blank');
        });
      }

      return row;
  }

  // ── Member Tooltip ──

  let _memberTipEl = null;

  function getMemberTipEl() {
    if (!_memberTipEl) {
      _memberTipEl = document.createElement('div');
      _memberTipEl.className = 'member-tooltip';
      document.body.appendChild(_memberTipEl);
    }
    return _memberTipEl;
  }

  function showMemberTooltip(mx, my, member) {
    const tip = getMemberTipEl();
    tip.textContent = '';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'member-tooltip__name';
    nameDiv.textContent = member.name + ' \u00B7 ' + member.pod;
    tip.appendChild(nameDiv);

    if (member.title) {
      const titleDiv = document.createElement('div');
      titleDiv.style.cssText = 'font-size:10px;color:var(--text-muted);margin-bottom:2px;';
      titleDiv.textContent = member.title;
      tip.appendChild(titleDiv);
    }

    // Status: for current user use localStorage profile; for others use Supabase fields
    const currentUser = DataLayer.getUser();
    const isMe = currentUser && member.name.toLowerCase().trim() === currentUser.toLowerCase().trim();
    let tipIcon = member.statusEmoji || '';
    let tipText = member.statusMessage || '';
    if (isMe) {
      const profile = DataLayer.getUserProfile();
      tipIcon = profile.statusIcon || member.statusEmoji || '';
      tipText = profile.tooltipText || member.statusMessage || '';
    }
    if (tipIcon || tipText) {
      const statusDiv = document.createElement('div');
      statusDiv.className = 'member-tooltip__status';
      statusDiv.textContent = (tipIcon ? tipIcon + ' ' : '') + tipText;
      tip.appendChild(statusDiv);
    }

    tip.style.left = (mx + 12) + 'px';
    tip.style.top = (my - 10) + 'px';
    tip.classList.add('visible');
  }

  function moveMemberTooltip(mx, my) {
    const tip = getMemberTipEl();
    tip.style.left = (mx + 12) + 'px';
    tip.style.top = (my - 10) + 'px';
  }

  function hideMemberTooltip() {
    const tip = getMemberTipEl();
    tip.classList.remove('visible');
  }

  // ── Certified Apps ──

  function renderCertifiedApps() {
    const strip = document.getElementById('appsStrip');
    const apps = DataLayer.getCertifiedApps();

    // Keep the label, remove app badges
    const badges = strip.querySelectorAll('.app-badge');
    badges.forEach(b => b.remove());

    apps.forEach(app => {
      const badge = document.createElement('a');
      badge.className = 'app-badge';
      badge.href = app.url;
      badge.target = '_blank';

      const icon = document.createElement('span');
      icon.className = 'app-badge__icon';
      icon.textContent = app.icon;
      badge.appendChild(icon);

      const text = document.createTextNode(app.name);
      badge.appendChild(text);

      strip.appendChild(badge);
    });
  }

  // ── Section Visibility ──

  function applyVisibility() {
    const map = {
      banner: 'banner',
      pods: 'podsGrid',
      bulletin: 'bulletinSection',
      teamStatus: 'teamStatusSection',
      certifiedApps: 'appsStrip'
    };

    Object.entries(map).forEach(([key, elId]) => {
      const el = document.getElementById(elId);
      if (el) {
        el.style.display = Settings.isSectionVisible(key) ? '' : 'none';
      }
    });
  }

  // ── Emoji Tinting (canvas-based monochrome) ──

  const _tintCache = {};

  /**
   * Renders an emoji onto a canvas and replaces all pixel colors with `hexColor`,
   * preserving the original alpha channel. Returns a data-URL for use as an <img>.
   */
  async function _tintEmoji(emoji, hexColor, size) {
    size = size || 128;
    const key = emoji + '|' + hexColor;
    if (_tintCache[key]) return _tintCache[key];

    // Parse hex → RGB
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      // Draw emoji centered
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = (size * 0.75) + 'px serif';
      ctx.fillText(emoji, size / 2, size / 2);

      // Replace RGB with pod color, preserve alpha
      const imageData = ctx.getImageData(0, 0, size, size);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 0) {        // has some opacity
          d[i]     = r;             // R
          d[i + 1] = g;             // G
          d[i + 2] = b;             // B
          // alpha stays as-is
        }
      }
      ctx.putImageData(imageData, 0, 0);

      const dataUrl = canvas.toDataURL('image/png');
      _tintCache[key] = dataUrl;
      return dataUrl;
    } catch (e) {
      return null;  // fallback to plain emoji text
    }
  }

  // ── Sparkline SVG Builder ──

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function buildSparklineSVG(incomingData, ahtData, podColor) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 200 80');
    svg.setAttribute('preserveAspectRatio', 'none');

    // ── Area chart for incoming tickets ──
    const inMax = Math.max(...incomingData) * 1.15;
    const inMin = Math.min(...incomingData) * 0.85;
    const inPoints = incomingData.map((v, i) => {
      const x = (i / (incomingData.length - 1)) * 200;
      const y = 80 - ((v - inMin) / (inMax - inMin)) * 70;
      return { x, y };
    });

    // Area fill
    const areaPath = document.createElementNS(SVG_NS, 'path');
    let areaD = 'M' + inPoints[0].x + ',' + inPoints[0].y;
    for (let i = 1; i < inPoints.length; i++) {
      areaD += ' L' + inPoints[i].x + ',' + inPoints[i].y;
    }
    areaD += ' L200,80 L0,80 Z';
    areaPath.setAttribute('d', areaD);
    areaPath.setAttribute('fill', podColor);
    areaPath.setAttribute('fill-opacity', '0.15');
    svg.appendChild(areaPath);

    // Area line
    const areaLine = document.createElementNS(SVG_NS, 'path');
    let lineD = 'M' + inPoints[0].x + ',' + inPoints[0].y;
    for (let i = 1; i < inPoints.length; i++) {
      lineD += ' L' + inPoints[i].x + ',' + inPoints[i].y;
    }
    areaLine.setAttribute('d', lineD);
    areaLine.setAttribute('fill', 'none');
    areaLine.setAttribute('stroke', podColor);
    areaLine.setAttribute('stroke-width', '2');
    areaLine.setAttribute('stroke-opacity', '0.5');
    svg.appendChild(areaLine);

    // ── Line chart for AHT (overlaid) ──
    if (ahtData && ahtData.length > 0) {
      const ahtMax = Math.max(...ahtData) * 1.15;
      const ahtMin = Math.min(...ahtData) * 0.85;
      const ahtPoints = ahtData.map((v, i) => {
        const x = (i / (ahtData.length - 1)) * 200;
        const y = 80 - ((v - ahtMin) / (ahtMax - ahtMin)) * 70;
        return { x, y };
      });

      const ahtLine = document.createElementNS(SVG_NS, 'path');
      let ahtD = 'M' + ahtPoints[0].x + ',' + ahtPoints[0].y;
      for (let i = 1; i < ahtPoints.length; i++) {
        ahtD += ' L' + ahtPoints[i].x + ',' + ahtPoints[i].y;
      }
      ahtLine.setAttribute('d', ahtD);
      ahtLine.setAttribute('fill', 'none');
      ahtLine.setAttribute('stroke', '#F59E0B');
      ahtLine.setAttribute('stroke-width', '2');
      ahtLine.setAttribute('stroke-dasharray', '4,3');
      svg.appendChild(ahtLine);
    }

    return svg;
  }

  // ── Chart Tooltip ──

  let _tooltipEl = null;

  function getTooltipEl() {
    if (!_tooltipEl) {
      _tooltipEl = document.createElement('div');
      _tooltipEl.className = 'pod-chart-tooltip';
      document.body.appendChild(_tooltipEl);
    }
    return _tooltipEl;
  }

  function showChartTooltip(mx, my, weekLabel, incoming, throughput, aht, responseSLA, resolutionSLA, totalBreaches, totalEscalations, podColor) {
    const tip = getTooltipEl();
    tip.textContent = '';

    const weekDiv = document.createElement('div');
    weekDiv.className = 'pod-chart-tooltip__week';
    weekDiv.textContent = weekLabel;
    tip.appendChild(weekDiv);

    // Incoming row
    const inRow = document.createElement('div');
    inRow.className = 'pod-chart-tooltip__row';
    const inDot = document.createElement('span');
    inDot.className = 'pod-chart-tooltip__dot';
    inDot.style.background = podColor;
    inRow.appendChild(inDot);
    inRow.appendChild(document.createTextNode('Incoming: ' + incoming));
    tip.appendChild(inRow);

    // Throughput row
    if (throughput !== undefined) {
      const tpRow = document.createElement('div');
      tpRow.className = 'pod-chart-tooltip__row';
      const tpDot = document.createElement('span');
      tpDot.className = 'pod-chart-tooltip__dot';
      tpDot.style.background = '#6366F1';
      tpRow.appendChild(tpDot);
      tpRow.appendChild(document.createTextNode('Throughput: ' + throughput));
      tip.appendChild(tpRow);
    }

    // AHT row
    if (aht !== undefined) {
      const ahtRow = document.createElement('div');
      ahtRow.className = 'pod-chart-tooltip__row';
      const ahtDot = document.createElement('span');
      ahtDot.className = 'pod-chart-tooltip__dot';
      ahtDot.style.background = '#F59E0B';
      ahtRow.appendChild(ahtDot);
      ahtRow.appendChild(document.createTextNode('AHT: ' + aht.toFixed(1) + 'h'));
      tip.appendChild(ahtRow);
    }

    // Response SLA row
    if (responseSLA !== undefined) {
      const rRow = document.createElement('div');
      rRow.className = 'pod-chart-tooltip__row';
      const rDot = document.createElement('span');
      rDot.className = 'pod-chart-tooltip__dot';
      rDot.style.background = '#22C55E';
      rRow.appendChild(rDot);
      rRow.appendChild(document.createTextNode('Response SLA: ' + responseSLA + '%'));
      tip.appendChild(rRow);
    }

    // Resolution SLA row
    if (resolutionSLA !== undefined) {
      const resRow = document.createElement('div');
      resRow.className = 'pod-chart-tooltip__row';
      const resDot = document.createElement('span');
      resDot.className = 'pod-chart-tooltip__dot';
      resDot.style.background = '#3B82F6';
      resRow.appendChild(resDot);
      resRow.appendChild(document.createTextNode('Resolution SLA: ' + resolutionSLA + '%'));
      tip.appendChild(resRow);
    }

    // Total Breaches row
    if (totalBreaches !== undefined) {
      const bRow = document.createElement('div');
      bRow.className = 'pod-chart-tooltip__row';
      const bDot = document.createElement('span');
      bDot.className = 'pod-chart-tooltip__dot';
      bDot.style.background = totalBreaches > 0 ? '#EF4444' : '#9CA3AF';
      bRow.appendChild(bDot);
      bRow.appendChild(document.createTextNode('Breaches: ' + totalBreaches));
      tip.appendChild(bRow);
    }

    // Total Escalations row
    if (totalEscalations !== undefined) {
      const eRow = document.createElement('div');
      eRow.className = 'pod-chart-tooltip__row';
      const eDot = document.createElement('span');
      eDot.className = 'pod-chart-tooltip__dot';
      eDot.style.background = totalEscalations > 0 ? '#F97316' : '#9CA3AF';
      eRow.appendChild(eDot);
      eRow.appendChild(document.createTextNode('Escalations: ' + totalEscalations));
      tip.appendChild(eRow);
    }

    tip.style.left = (mx + 12) + 'px';
    tip.style.top = (my - 10) + 'px';
    tip.classList.add('visible');
  }

  // ── SLA Color Helper ──

  function slaColorClass(value) {
    if (value >= 95) return 'pod-sla__value--good';
    if (value >= 85) return 'pod-sla__value--warn';
    return 'pod-sla__value--bad';
  }

  function hideChartTooltip() {
    const tip = getTooltipEl();
    tip.classList.remove('visible');
  }

  // ── Boot ──
  document.addEventListener('DOMContentLoaded', init);

  return { init, render, applyVisibility, showNameModal };
})();
