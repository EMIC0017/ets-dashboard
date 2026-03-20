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
        + '\nTeam: ' + (stats.teamSize || '?')
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
        // If it looks like a URL, render as tinted image; otherwise as emoji text
        if (customIcon.startsWith('http') || customIcon.startsWith('/') || customIcon.startsWith('data:')) {
          const img = document.createElement('img');
          img.src = customIcon;
          img.alt = '';
          bgIcon.appendChild(img);
        } else {
          bgIcon.textContent = customIcon;
        }
        // Apply monochromatic pod-color tint
        bgIcon.style.color = color;
        card.appendChild(bgIcon);
      }

      // Header row: name + team size
      const header = document.createElement('div');
      header.className = 'pod-card__header';

      const name = document.createElement('div');
      name.className = 'pod-card__name';
      name.textContent = pod.shortName;
      header.appendChild(name);

      const teamSize = document.createElement('span');
      teamSize.className = 'pod-card__team-size';
      teamSize.textContent = pod.stats?.teamSize ?? '?';
      header.appendChild(teamSize);

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
    area.appendChild(wrap);
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

    // On-call icon
    const icon = document.createElement('span');
    icon.className = 'on-call-bar__icon';
    icon.textContent = '\uD83D\uDCDF'; // 📟 pager
    bar.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'on-call-bar__label';
    const link = document.createElement('a');
    link.href = onCall.link || '#';
    link.target = '_blank';
    link.textContent = 'On-Call Team Member:';
    label.appendChild(link);
    bar.appendChild(label);

    // Incident status emoji (after label, before name)
    const statusEmoji = document.createElement('span');
    statusEmoji.style.fontSize = '14px';
    statusEmoji.style.marginLeft = 'auto';
    statusEmoji.textContent = onCall.inIncident ? '\uD83D\uDE1F' : '\uD83D\uDE0A'; // 😟 or 😊
    statusEmoji.title = onCall.inIncident ? 'In Incident' : 'Idle \u2014 No Active Incidents';
    bar.appendChild(statusEmoji);

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

    bar.appendChild(name);
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
      name.textContent = m.name;
      row.appendChild(name);

      // Status emoji inline (no text)
      if (m.statusEmoji) {
        const emoji = document.createElement('span');
        emoji.className = 'member-emoji';
        emoji.textContent = m.statusEmoji;
        row.appendChild(emoji);
      }

      // Hover tooltip with title & status
      row.addEventListener('mouseenter', (e) => {
        showMemberTooltip(e.clientX, e.clientY, m);
      });
      row.addEventListener('mousemove', (e) => {
        moveMemberTooltip(e.clientX, e.clientY);
      });
      row.addEventListener('mouseleave', hideMemberTooltip);

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

    if (member.statusEmoji || member.statusMessage) {
      const statusDiv = document.createElement('div');
      statusDiv.className = 'member-tooltip__status';
      statusDiv.textContent = (member.statusEmoji || '') + ' ' + (member.statusMessage || '');
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
