/* ─────────────────────────────────────────────
   settings.js — Settings Panel
   Toggle sections, admin features, color palette
   ───────────────────────────────────────────── */

const Settings = (() => {
  const PREFS_KEY = 'ets_prefs';
  const BANNER_DISMISSED_KEY = 'ets_banner_dismissed';

  function init() {
    document.getElementById('settingsBtn').addEventListener('click', open);
    document.getElementById('settingsClose').addEventListener('click', close);
    document.getElementById('settingsOverlay').addEventListener('click', close);
    document.getElementById('bannerDismiss').addEventListener('click', dismissBanner);
  }

  // ── Open / Close ──

  function open() {
    document.getElementById('settingsOverlay').classList.add('visible');
    document.getElementById('settingsPanel').classList.add('visible');
    renderSettingsBody();
  }

  function close() {
    document.getElementById('settingsOverlay').classList.remove('visible');
    document.getElementById('settingsPanel').classList.remove('visible');
  }

  // ── Preferences (localStorage) ──

  function getPrefs() {
    try {
      return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
    } catch { return {}; }
  }

  function savePref(key, value) {
    const prefs = getPrefs();
    prefs[key] = value;
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }

  function isSectionVisible(section) {
    const prefs = getPrefs();
    return prefs['hide_' + section] !== true;
  }

  // ── Banner ──

  function dismissBanner() {
    sessionStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    document.getElementById('banner').classList.add('hidden');
  }

  function isBannerDismissed() {
    return sessionStorage.getItem(BANNER_DISMISSED_KEY) === 'true';
  }

  // ── Render Settings Body ──

  function renderSettingsBody() {
    const body = document.getElementById('settingsBody');
    const currentUser = DataLayer.getUser();
    const isAdmin = DataLayer.isAdmin(currentUser);
    const prefs = getPrefs();

    body.textContent = '';

    // ── Preferences ──
    const prefsSection = createSection('Preferences');

    // Team sort toggle
    const sortMode = prefs.teamSortMode || 'pod';
    const sortRow = document.createElement('div');
    sortRow.className = 'settings-toggle';
    const sortLabel = document.createElement('span');
    sortLabel.className = 'settings-toggle__label';
    sortLabel.textContent = 'Team Status: ' + (sortMode === 'pod' ? 'By Pod' : 'A-Z');
    sortRow.appendChild(sortLabel);
    const sortToggleEl = createToggleInput(sortMode === 'pod', (checked) => {
      savePref('teamSortMode', checked ? 'pod' : 'alpha');
      sortLabel.textContent = 'Team Status: ' + (checked ? 'By Pod' : 'A-Z');
      if (typeof App !== 'undefined') App.render();
    });
    sortRow.appendChild(sortToggleEl);
    prefsSection.appendChild(sortRow);

    body.appendChild(prefsSection);

    // ── Banner Editor ──
    const bannerSection = createSection('Banner Message');

    const announcements = DataLayer.getAnnouncements();
    const activeBanner = announcements.find(a => a.active) || announcements[0] || null;
    const bannerColor = DataLayer.getBannerColor();

    // Color row
    const colorRow = document.createElement('div');
    colorRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';
    const colorLabel = document.createElement('span');
    colorLabel.style.cssText = 'font-size:12px;color:var(--text-secondary);';
    colorLabel.textContent = 'Color';
    colorRow.appendChild(colorLabel);

    const bannerColorInput = document.createElement('input');
    bannerColorInput.type = 'color';
    bannerColorInput.value = bannerColor;
    bannerColorInput.style.cssText = 'width:32px;height:24px;border:1px solid var(--border);border-radius:4px;cursor:pointer;padding:0;';
    colorRow.appendChild(bannerColorInput);

    // Preview swatch
    const swatch = document.createElement('div');
    swatch.style.cssText = 'flex:1;height:24px;border-radius:4px;background:' + bannerColor + ';';
    colorRow.appendChild(swatch);
    bannerColorInput.addEventListener('input', () => {
      swatch.style.background = bannerColorInput.value;
    });

    bannerSection.appendChild(colorRow);

    // Message text
    const msgLabel = document.createElement('span');
    msgLabel.style.cssText = 'font-size:12px;color:var(--text-secondary);display:block;margin-bottom:4px;';
    msgLabel.textContent = 'Message';
    bannerSection.appendChild(msgLabel);

    const msgInput = document.createElement('input');
    msgInput.type = 'text';
    msgInput.value = activeBanner ? activeBanner.text : '';
    msgInput.placeholder = 'Enter banner message...';
    msgInput.style.cssText = 'width:100%;height:32px;border:1px solid var(--border);border-radius:6px;padding:0 8px;font-size:12px;font-family:var(--font);outline:none;box-sizing:border-box;';
    bannerSection.appendChild(msgInput);

    // Link (optional)
    const linkLabel = document.createElement('span');
    linkLabel.style.cssText = 'font-size:12px;color:var(--text-secondary);display:block;margin:8px 0 4px;';
    linkLabel.textContent = 'Link (optional)';
    bannerSection.appendChild(linkLabel);

    const linkInput = document.createElement('input');
    linkInput.type = 'url';
    linkInput.value = (activeBanner && activeBanner.link) ? activeBanner.link : '';
    linkInput.placeholder = 'https://...';
    linkInput.style.cssText = 'width:100%;height:32px;border:1px solid var(--border);border-radius:6px;padding:0 8px;font-size:12px;font-family:var(--font);outline:none;box-sizing:border-box;';
    bannerSection.appendChild(linkInput);

    // Active toggle
    const activeRow = document.createElement('div');
    activeRow.className = 'settings-toggle';
    activeRow.style.marginTop = '8px';
    const activeLabel = document.createElement('span');
    activeLabel.className = 'settings-toggle__label';
    activeLabel.textContent = 'Show banner';
    activeRow.appendChild(activeLabel);
    const activeToggle = createToggleInput(activeBanner ? activeBanner.active !== false : true, () => {});
    activeRow.appendChild(activeToggle);
    bannerSection.appendChild(activeRow);

    // Scroll ticker toggle
    const scrollRow = document.createElement('div');
    scrollRow.className = 'settings-toggle';
    scrollRow.style.marginTop = '4px';
    const scrollLabel = document.createElement('span');
    scrollLabel.className = 'settings-toggle__label';
    scrollLabel.textContent = 'Scroll as ticker';
    scrollRow.appendChild(scrollLabel);
    const isScrolling = localStorage.getItem('ets_banner_scroll') === 'true';
    const scrollToggle = createToggleInput(isScrolling, () => {});
    scrollRow.appendChild(scrollToggle);
    bannerSection.appendChild(scrollRow);

    // Save button
    const bannerSaveBtn = document.createElement('button');
    bannerSaveBtn.className = 'settings-btn';
    bannerSaveBtn.textContent = 'Update Banner';
    bannerSaveBtn.style.cssText = 'margin-top:10px;padding:6px 16px;font-weight:600;width:100%;';
    bannerSaveBtn.addEventListener('click', () => {
      const text = msgInput.value.trim();
      const link = linkInput.value.trim() || null;
      const isActive = activeToggle.querySelector('input').checked;

      // Save banner color
      DataLayer.saveBannerColor(bannerColorInput.value);

      // Save scroll preference
      const shouldScroll = scrollToggle.querySelector('input').checked;
      localStorage.setItem('ets_banner_scroll', shouldScroll ? 'true' : 'false');

      // Save announcement
      const updated = [{
        id: activeBanner ? activeBanner.id : '1',
        text: text || 'Welcome to the ETS Dashboard!',
        link: link,
        active: isActive
      }];
      DataLayer.saveAnnouncements(updated);

      // Clear dismissed state so it shows again
      sessionStorage.removeItem('ets_banner_dismissed');

      if (typeof App !== 'undefined') App.render();

      // Visual feedback
      bannerSaveBtn.textContent = 'Saved!';
      setTimeout(() => { bannerSaveBtn.textContent = 'Update Banner'; }, 1200);
    });
    bannerSection.appendChild(bannerSaveBtn);

    body.appendChild(bannerSection);

    // ── Admin Features ──
    if (isAdmin) {
      // Pod Appearance (color + icon)
      const colorSection = createSection('Pod Appearance');
      const adminBadge = document.createElement('span');
      adminBadge.className = 'admin-badge';
      adminBadge.textContent = 'ADMIN';
      colorSection.querySelector('.settings-section__title').appendChild(adminBadge);

      const pods = DataLayer.getPods();
      const settings = DataLayer.getSettings();
      const podColors = settings.podColors || {};

      pods.forEach(pod => {
        const row = document.createElement('div');
        row.className = 'color-picker-row';

        const label = document.createElement('span');
        label.className = 'color-picker-row__label';
        label.textContent = pod.shortName;
        row.appendChild(label);

        // Icon picker button
        const podSettings = DataLayer.getPodSettings ? DataLayer.getPodSettings(pod.shortName) : {};
        const currentIcon = podSettings.bgIcon || pod.icon || '';

        const iconBtn = document.createElement('button');
        iconBtn.className = 'pod-icon-picker-btn';
        iconBtn.textContent = currentIcon;
        iconBtn.title = 'Click to change card icon';
        iconBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          _openMiniEmojiPicker(iconBtn, pod.shortName, currentIcon);
        });
        row.appendChild(iconBtn);

        // Color picker
        const input = document.createElement('input');
        input.type = 'color';
        input.value = podColors[pod.shortName] || pod.color;
        input.addEventListener('change', () => {
          const customColors = getPrefs().customPodColors || {};
          customColors[pod.shortName] = input.value;
          savePref('customPodColors', customColors);
          if (typeof App !== 'undefined') App.render();
        });
        row.appendChild(input);

        colorSection.appendChild(row);
      });
      body.appendChild(colorSection);

      // ── Mini Emoji Picker for Pod Icons ──
      let _miniPicker = null;

      function _openMiniEmojiPicker(anchorBtn, podName, currentIcon) {
        // Close existing
        if (_miniPicker) { _miniPicker.remove(); _miniPicker = null; }

        const picker = document.createElement('div');
        picker.className = 'mini-emoji-picker';

        // Position below the button
        const rect = anchorBtn.getBoundingClientRect();
        picker.style.top = (rect.bottom + 4) + 'px';
        picker.style.left = rect.left + 'px';

        // Search input
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'mini-emoji-picker__search';
        searchInput.placeholder = 'Search icons...';
        picker.appendChild(searchInput);

        // Results grid
        const grid = document.createElement('div');
        grid.className = 'mini-emoji-picker__grid';
        picker.appendChild(grid);

        // Render emojis
        function renderResults(query) {
          grid.textContent = '';
          const results = query
            ? EmojiData.search(query).slice(0, 40)
            : EmojiData.getAll().slice(0, 40);
          results.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'mini-emoji-picker__item';
            btn.textContent = item.emoji;
            btn.title = item.name || '';
            if (item.emoji === currentIcon) btn.classList.add('mini-emoji-picker__item--active');
            btn.addEventListener('click', () => {
              // Save to pod settings
              const ps = DataLayer.getPodSettings ? DataLayer.getPodSettings(podName) : {};
              ps.bgIcon = item.emoji;
              if (DataLayer.savePodSettings) DataLayer.savePodSettings(podName, ps);
              anchorBtn.textContent = item.emoji;
              if (_miniPicker) { _miniPicker.remove(); _miniPicker = null; }
              if (typeof App !== 'undefined') App.render();
            });
            grid.appendChild(btn);
          });
          if (results.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'grid-column:1/-1;text-align:center;color:var(--text-muted);font-size:11px;padding:8px;';
            empty.textContent = 'No matches';
            grid.appendChild(empty);
          }
        }

        renderResults('');

        let _debounce = null;
        searchInput.addEventListener('input', () => {
          clearTimeout(_debounce);
          _debounce = setTimeout(() => renderResults(searchInput.value.trim()), 150);
        });

        document.body.appendChild(picker);
        _miniPicker = picker;
        searchInput.focus();

        // Close on click outside
        setTimeout(() => {
          document.addEventListener('click', function closer(e) {
            if (picker.contains(e.target) || e.target === anchorBtn) return;
            picker.remove();
            _miniPicker = null;
            document.removeEventListener('click', closer);
          });
        }, 0);
      }

      // Sticker Management
      const stickerSection = createSection('Sticker Management');
      const stickerAdminBadge = document.createElement('span');
      stickerAdminBadge.className = 'admin-badge';
      stickerAdminBadge.textContent = 'ADMIN';
      stickerSection.querySelector('.settings-section__title').appendChild(stickerAdminBadge);

      const stickers = DataLayer.loadStickers();
      if (stickers.length > 0) {
        const table = document.createElement('table');
        table.className = 'sticker-table';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        ['Icon', 'By', 'Placed', 'Persist', ''].forEach(text => {
          const th = document.createElement('th');
          th.textContent = text;
          headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        stickers.forEach(s => {
          const tr = document.createElement('tr');

          const tdIcon = document.createElement('td');
          tdIcon.textContent = s.icon;
          tr.appendChild(tdIcon);

          const tdBy = document.createElement('td');
          tdBy.textContent = s.placedBy;
          tr.appendChild(tdBy);

          const tdTime = document.createElement('td');
          tdTime.textContent = new Date(s.placedAt).toLocaleDateString();
          tr.appendChild(tdTime);

          const tdPersist = document.createElement('td');
          const persistToggle = createToggleInput(s.persistent, () => {
            DataLayer.toggleStickerPersistent(s.id);
            Stickers.renderStickers();
            renderSettingsBody(); // re-render table
          });
          tdPersist.appendChild(persistToggle);
          tr.appendChild(tdPersist);

          const tdDelete = document.createElement('td');
          const delBtn = document.createElement('button');
          delBtn.className = 'sticker-table__delete';
          delBtn.textContent = '\u2715';
          delBtn.addEventListener('click', () => {
            DataLayer.removeSticker(s.id);
            Stickers.renderStickers();
            renderSettingsBody();
          });
          tdDelete.appendChild(delBtn);
          tr.appendChild(tdDelete);

          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        stickerSection.appendChild(table);
      } else {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No stickers placed yet';
        stickerSection.appendChild(empty);
      }

      // Clear all button
      const clearBtn = document.createElement('button');
      clearBtn.className = 'settings-btn settings-btn--danger';
      clearBtn.textContent = 'Clear All Stickers';
      clearBtn.style.marginTop = '10px';
      clearBtn.addEventListener('click', () => {
        if (confirm('Remove all stickers from the dashboard?')) {
          DataLayer.clearAllStickers();
          Stickers.renderStickers();
          renderSettingsBody();
        }
      });
      stickerSection.appendChild(clearBtn);

      body.appendChild(stickerSection);

      // Certified Apps Management
      const appsSection = createSection('Certified Apps');
      const appsBadge = document.createElement('span');
      appsBadge.className = 'admin-badge';
      appsBadge.textContent = 'ADMIN';
      appsSection.querySelector('.settings-section__title').appendChild(appsBadge);

      const apps = DataLayer.getCertifiedApps();
      if (apps.length > 0) {
        const appsTable = document.createElement('table');
        appsTable.className = 'sticker-table';

        const appsThead = document.createElement('thead');
        const appsHeaderRow = document.createElement('tr');
        ['', 'Name', 'URL', ''].forEach(text => {
          const th = document.createElement('th');
          th.textContent = text;
          appsHeaderRow.appendChild(th);
        });
        appsThead.appendChild(appsHeaderRow);
        appsTable.appendChild(appsThead);

        const appsTbody = document.createElement('tbody');
        // Helper: make a table cell editable on click
        function makeEditable(td, value, fieldWidth, onSave) {
          td.style.cursor = 'pointer';
          td.title = 'Click to edit';
          td.addEventListener('click', (e) => {
            e.stopPropagation();
            if (td.querySelector('input')) return; // already editing
            const input = document.createElement('input');
            input.type = 'text';
            input.value = value;
            input.style.cssText = 'width:' + fieldWidth + ';height:24px;border:1px solid var(--border);border-radius:4px;padding:0 4px;font-size:12px;font-family:var(--font);outline:none;';
            td.textContent = '';
            td.appendChild(input);
            input.focus();
            input.select();
            const commit = () => {
              const newVal = input.value.trim();
              if (newVal && newVal !== value) {
                onSave(newVal);
                if (typeof App !== 'undefined') App.render();
                renderSettingsBody();
              } else {
                td.textContent = value;
              }
            };
            input.addEventListener('blur', commit);
            input.addEventListener('keydown', (ke) => {
              if (ke.key === 'Enter') commit();
              if (ke.key === 'Escape') { td.textContent = value; }
            });
          });
        }

        apps.forEach(app => {
          const tr = document.createElement('tr');

          const tdIcon = document.createElement('td');
          tdIcon.textContent = app.icon;
          makeEditable(tdIcon, app.icon, '36px', (val) => {
            app.icon = val;
            DataLayer.saveCertifiedApps(apps);
          });
          tr.appendChild(tdIcon);

          const tdName = document.createElement('td');
          tdName.textContent = app.name;
          tdName.style.fontWeight = '500';
          makeEditable(tdName, app.name, '100%', (val) => {
            app.name = val;
            DataLayer.saveCertifiedApps(apps);
          });
          tr.appendChild(tdName);

          const tdUrl = document.createElement('td');
          const urlDisplay = document.createElement('span');
          try { urlDisplay.textContent = new URL(app.url).hostname; }
          catch { urlDisplay.textContent = app.url; }
          urlDisplay.style.cssText = 'color:#3B82F6;font-size:11px;';
          tdUrl.appendChild(urlDisplay);
          makeEditable(tdUrl, app.url, '100%', (val) => {
            try { new URL(val); } catch { return; }
            app.url = val;
            DataLayer.saveCertifiedApps(apps);
          });
          tr.appendChild(tdUrl);

          const tdDelete = document.createElement('td');
          const delBtn = document.createElement('button');
          delBtn.className = 'sticker-table__delete';
          delBtn.textContent = '\u2715';
          delBtn.addEventListener('click', () => {
            DataLayer.removeCertifiedApp(app.id);
            if (typeof App !== 'undefined') App.render();
            renderSettingsBody();
          });
          tdDelete.appendChild(delBtn);
          tr.appendChild(tdDelete);

          appsTbody.appendChild(tr);
        });
        appsTable.appendChild(appsTbody);
        appsSection.appendChild(appsTable);
      } else {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No certified apps configured';
        appsSection.appendChild(empty);
      }

      // Add App form
      const addForm = document.createElement('div');
      addForm.style.cssText = 'display:grid;grid-template-columns:36px 1fr 1fr auto;gap:6px;margin-top:10px;align-items:center;';

      const iconInput = document.createElement('input');
      iconInput.type = 'text';
      iconInput.placeholder = '\uD83D\uDCCC';
      iconInput.style.cssText = 'width:36px;height:32px;border:1px solid var(--border);border-radius:6px;text-align:center;font-size:16px;padding:0;font-family:var(--font);outline:none;';
      addForm.appendChild(iconInput);

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.placeholder = 'App name';
      nameInput.style.cssText = 'height:32px;border:1px solid var(--border);border-radius:6px;padding:0 8px;font-size:12px;font-family:var(--font);outline:none;';
      addForm.appendChild(nameInput);

      const urlInput = document.createElement('input');
      urlInput.type = 'text';
      urlInput.placeholder = 'https://...';
      urlInput.style.cssText = 'height:32px;border:1px solid var(--border);border-radius:6px;padding:0 8px;font-size:12px;font-family:var(--font);outline:none;';
      addForm.appendChild(urlInput);

      const addBtn = document.createElement('button');
      addBtn.className = 'settings-btn';
      addBtn.textContent = '+';
      addBtn.style.cssText = 'font-size:16px;padding:4px 10px;height:32px;font-weight:600;';
      addBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        const url = urlInput.value.trim();
        const icon = iconInput.value.trim() || '\uD83D\uDD17';
        if (!name || !url) return;
        // Basic URL validation
        try { new URL(url); } catch { urlInput.style.borderColor = '#EF4444'; return; }
        DataLayer.addCertifiedApp({ name, url, icon });
        if (typeof App !== 'undefined') App.render();
        renderSettingsBody();
      });
      addForm.appendChild(addBtn);

      appsSection.appendChild(addForm);
      body.appendChild(appsSection);

      // Slack Integration (admin)
      const slackSection = createSection('Slack Integration');
      const slackBadge = document.createElement('span');
      slackBadge.className = 'admin-badge';
      slackBadge.textContent = 'ADMIN';
      slackSection.querySelector('.settings-section__title').appendChild(slackBadge);

      const slackDesc = document.createElement('div');
      slackDesc.style.cssText = 'font-size:11px;color:var(--text-muted);margin-bottom:8px;';
      slackDesc.textContent = 'Enter the URL of a presence proxy to enable live Slack status indicators. The proxy should accept ?users=U1,U2 and return { "U1": "active", "U2": "away" }.';
      slackSection.appendChild(slackDesc);

      const slackRow = document.createElement('div');
      slackRow.style.cssText = 'display:flex;gap:6px;align-items:center;';
      const slackInput = document.createElement('input');
      slackInput.type = 'url';
      slackInput.placeholder = 'https://your-proxy.example.com/slack-presence';
      slackInput.value = (typeof SlackStatus !== 'undefined') ? SlackStatus.getProxyUrl() : '';
      slackInput.style.cssText = 'flex:1;height:32px;border:1px solid var(--border);border-radius:6px;padding:0 8px;font-size:12px;font-family:var(--font);outline:none;';
      slackRow.appendChild(slackInput);

      const slackSaveBtn = document.createElement('button');
      slackSaveBtn.className = 'settings-btn';
      slackSaveBtn.textContent = 'Save';
      slackSaveBtn.style.cssText = 'padding:4px 12px;height:32px;font-weight:600;';
      slackSaveBtn.addEventListener('click', () => {
        if (typeof SlackStatus !== 'undefined') {
          SlackStatus.configure(slackInput.value.trim());
          SlackStatus.refresh();
        }
      });
      slackRow.appendChild(slackSaveBtn);
      slackSection.appendChild(slackRow);

      const slackNote = document.createElement('div');
      slackNote.style.cssText = 'font-size:10px;color:#94A3B8;margin-top:6px;';
      slackNote.textContent = 'Without a proxy, status dots show config defaults. The proxy polls every 2 minutes.';
      slackSection.appendChild(slackNote);

      body.appendChild(slackSection);

      // Admin List
      const adminSection = createSection('Admin List');
      const adminListBadge = document.createElement('span');
      adminListBadge.className = 'admin-badge';
      adminListBadge.textContent = 'ADMIN';
      adminSection.querySelector('.settings-section__title').appendChild(adminListBadge);

      const admins = DataLayer.getAdmins();
      const adminList = document.createElement('div');
      adminList.style.fontSize = '12px';
      adminList.style.color = '#64748B';
      admins.forEach(name => {
        const row = document.createElement('div');
        row.style.padding = '4px 0';
        row.textContent = name;
        adminList.appendChild(row);
      });
      adminSection.appendChild(adminList);

      const note = document.createElement('div');
      note.style.fontSize = '10px';
      note.style.color = '#94A3B8';
      note.style.marginTop = '8px';
      note.textContent = 'v1: Admin list is defined in dashboard-config.json. Federated auth coming in v2.';
      adminSection.appendChild(note);

      body.appendChild(adminSection);
    }

    // ── Team Roster (admin) ──
    if (isAdmin) {
      const rosterSection = createSection('Team Roster');
      const rosterBadge = document.createElement('span');
      rosterBadge.className = 'admin-badge';
      rosterBadge.textContent = 'ADMIN';
      rosterSection.querySelector('.settings-section__title').appendChild(rosterBadge);

      const members = DataLayer.getTeamRoster();
      const pods = DataLayer.getPods();
      const podNames = pods.map(p => p.shortName);

      // Scrollable table container
      const tableWrap = document.createElement('div');
      tableWrap.style.cssText = 'max-height:260px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;';

      const table = document.createElement('table');
      table.className = 'sticker-table';
      table.style.margin = '0';

      const thead = document.createElement('thead');
      thead.style.position = 'sticky';
      thead.style.top = '0';
      thead.style.background = 'var(--card-bg)';
      thead.style.zIndex = '1';
      const hRow = document.createElement('tr');
      ['Name', 'Pod', ''].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        hRow.appendChild(th);
      });
      thead.appendChild(hRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');

      // Sort members by pod then name for readability
      const sorted = [...members].sort((a, b) => {
        const podCmp = (a.pod || '').localeCompare(b.pod || '');
        if (podCmp !== 0) return podCmp;
        return (a.name || '').localeCompare(b.name || '');
      });

      sorted.forEach(member => {
        const tr = document.createElement('tr');

        // Name (editable inline)
        const tdName = document.createElement('td');
        const nameSpan = document.createElement('span');
        nameSpan.textContent = member.name;
        nameSpan.style.cssText = 'font-size:12px;cursor:text;';
        if (member.role === 'leader') {
          nameSpan.style.fontWeight = '700';
        }
        nameSpan.addEventListener('dblclick', () => {
          const input = document.createElement('input');
          input.type = 'text';
          input.value = member.name;
          input.style.cssText = 'width:100%;border:1px solid var(--border);border-radius:4px;padding:2px 4px;font-size:12px;font-family:var(--font);outline:none;';
          input.addEventListener('blur', () => {
            const val = input.value.trim();
            if (val && val !== member.name) {
              DataLayer.updateTeamMember(member.id, { name: val });
              if (typeof App !== 'undefined') App.render();
            }
            renderSettingsBody();
          });
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') input.blur();
            if (e.key === 'Escape') renderSettingsBody();
          });
          tdName.textContent = '';
          tdName.appendChild(input);
          input.focus();
          input.select();
        });
        tdName.appendChild(nameSpan);
        tr.appendChild(tdName);

        // Pod dropdown
        const tdPod = document.createElement('td');
        const select = document.createElement('select');
        select.style.cssText = 'border:1px solid var(--border);border-radius:4px;padding:2px 4px;font-size:11px;font-family:var(--font);outline:none;cursor:pointer;background:var(--card-bg);';
        podNames.forEach(pn => {
          const opt = document.createElement('option');
          opt.value = pn;
          opt.textContent = pn;
          if (pn === member.pod) opt.selected = true;
          select.appendChild(opt);
        });
        select.addEventListener('change', () => {
          DataLayer.updateTeamMember(member.id, { pod: select.value });
          if (typeof App !== 'undefined') App.render();
        });
        tdPod.appendChild(select);
        tr.appendChild(tdPod);

        // Delete
        const tdDel = document.createElement('td');
        const delBtn = document.createElement('button');
        delBtn.className = 'sticker-table__delete';
        delBtn.textContent = '\u2715';
        delBtn.addEventListener('click', () => {
          DataLayer.removeTeamMember(member.id);
          if (typeof App !== 'undefined') App.render();
          renderSettingsBody();
        });
        tdDel.appendChild(delBtn);
        tr.appendChild(tdDel);

        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableWrap.appendChild(table);
      rosterSection.appendChild(tableWrap);

      // Member count
      const countLabel = document.createElement('div');
      countLabel.style.cssText = 'font-size:10px;color:var(--text-muted);margin-top:6px;';
      countLabel.textContent = members.length + ' members';
      rosterSection.appendChild(countLabel);

      // Add member row
      const addRow = document.createElement('div');
      addRow.style.cssText = 'display:grid;grid-template-columns:1fr auto auto;gap:6px;margin-top:8px;align-items:center;';

      const newName = document.createElement('input');
      newName.type = 'text';
      newName.placeholder = 'New member name';
      newName.style.cssText = 'height:30px;border:1px solid var(--border);border-radius:6px;padding:0 8px;font-size:12px;font-family:var(--font);outline:none;';
      addRow.appendChild(newName);

      const newPod = document.createElement('select');
      newPod.style.cssText = 'height:30px;border:1px solid var(--border);border-radius:6px;padding:0 6px;font-size:11px;font-family:var(--font);outline:none;cursor:pointer;background:var(--card-bg);';
      podNames.forEach(pn => {
        const opt = document.createElement('option');
        opt.value = pn;
        opt.textContent = pn;
        newPod.appendChild(opt);
      });
      addRow.appendChild(newPod);

      const addMemberBtn = document.createElement('button');
      addMemberBtn.className = 'settings-btn';
      addMemberBtn.textContent = '+';
      addMemberBtn.style.cssText = 'font-size:16px;padding:2px 10px;height:30px;font-weight:600;';
      addMemberBtn.addEventListener('click', () => {
        const name = newName.value.trim();
        if (!name) { newName.style.borderColor = '#EF4444'; return; }
        DataLayer.addTeamMember({ name, pod: newPod.value });
        if (typeof App !== 'undefined') App.render();
        renderSettingsBody();
      });
      addRow.appendChild(addMemberBtn);

      rosterSection.appendChild(addRow);

      // Hint
      const hint = document.createElement('div');
      hint.style.cssText = 'font-size:10px;color:var(--text-muted);margin-top:6px;';
      hint.textContent = 'Double-click a name to edit. v2: auto-syncs from Slack channel.';
      rosterSection.appendChild(hint);

      body.appendChild(rosterSection);
    }

    // ── User Info (compact) ──
    const userRow = document.createElement('div');
    userRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid var(--border);margin-top:8px;font-size:12px;color:var(--text-muted);';
    const userLabel = document.createElement('span');
    userLabel.textContent = currentUser || 'Unknown';
    userRow.appendChild(userLabel);
    const changeBtn = document.createElement('button');
    changeBtn.className = 'settings-btn';
    changeBtn.textContent = 'Change';
    changeBtn.style.fontSize = '11px';
    changeBtn.style.padding = '4px 10px';
    changeBtn.addEventListener('click', () => {
      localStorage.removeItem('ets_username');
      close();
      if (typeof App !== 'undefined') App.showNameModal();
    });
    userRow.appendChild(changeBtn);
    body.appendChild(userRow);
  }

  // ── DOM Helpers ──

  function createSection(title) {
    const section = document.createElement('div');
    section.className = 'settings-section';
    const titleEl = document.createElement('div');
    titleEl.className = 'settings-section__title';
    titleEl.textContent = title;
    section.appendChild(titleEl);
    return section;
  }

  function createToggleRow(label, checked, onChange) {
    const row = document.createElement('div');
    row.className = 'settings-toggle';

    const labelEl = document.createElement('span');
    labelEl.className = 'settings-toggle__label';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    row.appendChild(createToggleInput(checked, onChange));
    return row;
  }

  function createToggleInput(checked, onChange) {
    const toggle = document.createElement('label');
    toggle.className = 'toggle-switch';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    toggle.appendChild(input);
    const slider = document.createElement('span');
    slider.className = 'toggle-switch__slider';
    toggle.appendChild(slider);
    return toggle;
  }

  return { init, open, close, isSectionVisible, isBannerDismissed, getPrefs };
})();
