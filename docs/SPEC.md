# ETS Dashboard — Design Specification v1.0

**Date:** 2026-03-20
**Platform:** Superblocks (hosted + data layer)
**Data Layer (v1):** Static JSON; architected for Superblocks API integrations
**Auth (v1):** Name prompt on first visit (localStorage); federated auth planned for v2
**Target:** Full-screen, no-scroll, single-pane-of-glass dashboard for the ETS team

---

## 1. Page Layout (No-Scroll, Full-Screen)

```
┌─────────────────────────────────────────────────────────┐
│  ANNOUNCEMENT BANNER (bright accent, dismissible)       │
│─────────────────────────────────────────────────────────│
│              Welcome to ETS                             │
│              (friendly rounded font)            [⚙ gear]│
├────────────────────┬────────────────────┬───────────────┤
│   POD TILES        │   CENTER COLUMN    │  TEAM STATUS  │
│   (2×3 grid)       │                    │  WIDGET       │
│                    │  Upcoming Meetings │               │
│  ┌─────┐ ┌─────┐  │  (Google Calendar) │  ● Name 💬   │
│  │ Ads │ │ Cat │  │                    │  ● Name 💬   │
│  ├─────┤ ├─────┤  │  ─────────────     │  ● Name 💬   │
│  │Caper│ │FaaS │  │                    │  (internal    │
│  ├─────┤ ├─────┤  │  News / Bulletin   │   scroll,     │
│  │ FS  │ │ WL  │  │  Board             │   small font) │
│                    │                    │               │
├────────────────────┴────────────────────┴───────────────┤
│  CERTIFIED TEAM APPS  [ Champ ] [ App2 ] [ App3 ] ...  │
└─────────────────────────────────────────────────────────┘

  + Floating sticker bubbles (movable, anywhere on page)
```

### 1.1 Zones

| Zone | Width | Content |
|------|-------|---------|
| Announcement Banner | 100% | Bright accent color. Dismissible per-session (localStorage). Hidden when empty. |
| Header | 100% | "Welcome to ETS" — centered, friendly rounded font (Poppins or Nunito). Settings gear icon top-right. |
| Left Column | ~30% | 2×3 grid of pod tiles |
| Center Column | ~40% | Upcoming team meetings (top), bulletin board / news (bottom) |
| Right Column | ~30% | Team member status widget |
| Bottom Strip | 100% | Certified Team Apps as clickable tiles/badges |
| Floating Layer | overlay | Draggable sticker bubbles |

### 1.2 Overflow Handling

All variable-length sections use **internal scroll** (the outer page never scrolls):
- Team status widget: small font, internal scroll, sorted by online status then alphabetical
- Meetings: show next 3–5, internal scroll if more
- Bulletin board: newest first, internal scroll
- Minimum supported resolution: 1440×900

---

## 2. Pods

### 2.1 Pod Definitions

| Short Name | Full Name | Default Accent Color |
|------------|-----------|---------------------|
| Ads | Ads | Blue (#3B82F6) |
| Cat | Catalog | Green (#22C55E) |
| Caper | Caper Carts | Orange (#F97316) |
| FaaS | FaaS | Purple (#8B5CF6) |
| FS | Foodstorm | Coral (#EF4444) |
| WL | White Label | Teal (#14B8A6) |

### 2.2 Pod Tile Card

Each tile displays:
- Pod short name (prominent)
- Three stat badges: **Incoming tickets** (week), **Throughput** (week), **Team size**
- Subtle shadow, rounded corners, colored left border or header using pod accent color
- Hover: slight lift + glow animation
- Click: navigates to pod sub-page

### 2.3 Pod Sub-Pages

Each sub-page mirrors the main page layout, scoped to that pod:
- Pod name as header
- Pod-specific announcements / bulletin
- Pod-specific upcoming meetings (filtered by calendar tags or manual assignment)
- Pod team member statuses (filtered by `pod` field)
- Back button to return to main dashboard

---

## 3. Team Member Status Widget

- Each row: presence dot (green=online, yellow=away, gray=offline) + name + custom status message/emoji
- Font size: small (~12px) to accommodate up to 45 members
- Internal scroll, sorted: online first, then away, then offline; alphabetical within each group
- **v1:** Manual status entry via name prompt; stored in Superblocks datastore
- **Future:** Integrated with Slack API for live presence + custom status/emoji

### 3.1 Team Member Data Fields

```json
{
  "id": "string",
  "name": "string",
  "pod": "Ads|Cat|Caper|FaaS|FS|WL",
  "status": "online|away|offline",
  "statusMessage": "string (optional)",
  "statusEmoji": "string (optional)"
}
```

---

## 4. Meetings Section

- Source: Google Calendar integration
- Calendar ID: `c_eecaf4fdf56ce404ba7074068c8ed32ff3ce0eb0736907dd42876d906bec7901@group.calendar.google.com`
- Display: title, date/time, duration, meeting link (clickable), attendees
- Filter: only future meetings shown (past meetings excluded)
- Timezone: user's local timezone via browser API
- **v1:** Static JSON mock data; architecture ready for Google Calendar API via Superblocks

---

## 5. Announcement Banner

- Bright accent color (configurable), spans full width
- Dismissible per browser session (dismiss state stored in sessionStorage)
- Hidden entirely when no active announcements
- Managed by admins via settings gear panel
- Content: plain text with optional link

---

## 6. Bulletin Board / News

- Located in center column below meetings
- Newest entries sorted first
- Internal scroll
- Managed by admins via settings gear panel
- **v1:** Manual entry
- **Future:** Slack channel integration

---

## 7. Certified Team Apps

- Bottom strip of clickable tiles/badges
- Each app: icon + name + URL
- First entry: **Champ** (https://dash.champ.ai/app)
- Managed by admins via settings gear panel
- Icon format: emoji character or URL to image

---

## 8. Sticker / Bubble System

### 8.1 Placement
- "+" button in bottom-left corner opens a sticker picker tray
- Picker offers a curated set of emoji/icons
- User selects an emoji, then clicks anywhere on the page to place it
- Sticker appears as a draggable circular bubble with slight transparency and soft drop shadow
- Gentle bounce animation on placement

### 8.2 Persistence & Expiry
- All stickers stored in Superblocks datastore (shared across all users)
- **Default expiry:** 24 hours after placement, auto-removed
- Admins can mark any sticker as **persistent** (no expiry)
- Admins can **"Clear All Stickers"** from settings panel

### 8.3 Visibility & Position
- Sticker positions are **shared** — everyone sees stickers in the same location
- When a user drags a sticker, the new position is saved and visible to all users on next refresh (15s polling)
- Hover over a sticker reveals tooltip: who placed it + when

### 8.4 Removal
- Only the person who placed the sticker (name match) or an admin can remove it
- Expired stickers are auto-cleaned on each data refresh cycle

### 8.5 Sticker Data Schema

```json
{
  "id": "uuid",
  "icon": "emoji character",
  "placedBy": "string (user name)",
  "placedAt": "ISO 8601 timestamp",
  "expiresAt": "ISO 8601 timestamp | null (if persistent)",
  "persistent": false,
  "x": 0.5,
  "y": 0.3
}
```

Position uses **normalized coordinates** (0–1 range) so stickers scale with viewport.

---

## 9. Settings Gear Panel

Slide-out panel from top-right corner.

### 9.1 All Users
- Toggle section visibility: banner, pod tiles, meetings, bulletin, team status, certified apps
- Preferences stored in **localStorage** (per-user, per-browser)

### 9.2 Admin-Only Features
- Manage announcements (add / edit / remove)
- Manage bulletin board entries (add / edit / remove)
- Manage certified app links (add / edit / remove)
- **Sticker management table:** columns — sticker icon, placed by, placed at, expires at, persistent toggle, delete button. Plus "Clear All Stickers" button.
- **Pod color palette editor:** color picker per pod
- **Admin list editor:** add/remove names from admin list

### 9.3 Admin Detection
- Admin list defined in config JSON (array of name strings)
- Matched against the user's self-identified name (from first-visit prompt)
- **Known v1 limitation:** No verification — anyone can type an admin's name. Accepted risk; federated auth in v2 will resolve this.

---

## 10. User Identity (v1)

- On first visit, a friendly modal prompts: "What's your name?"
- Name stored in **localStorage**
- Used for: sticker attribution, admin matching, status widget
- No password or verification in v1
- **Future:** Federated auth (SSO) via Instacart identity provider

---

## 11. Auto-Refresh

- `setInterval` polling every **15 seconds**
- Fetches: stickers, announcements, bulletin, team statuses, meetings (when integrated)
- **v1:** Re-reads Superblocks datastore (stickers, announcements, bulletin are live; other data is static JSON)
- Smooth CSS transitions on data changes (no jarring full reloads)
- "Last updated" timestamp displayed subtly (bottom-right or footer)

---

## 12. Visual Identity

- **Font:** Poppins or Nunito (rounded, friendly sans-serif)
- **Background:** Light neutral off-white (#F8FAFC)
- **Cards:** White with subtle shadow, rounded corners (8–12px radius)
- **Pod accent colors:** Configurable via settings (defaults in Section 2.1)
- **Announcement banner:** Bold, bright (default coral #EF4444)
- **Sticker bubbles:** Slight transparency (0.85 opacity), soft drop shadow, bounce-in animation
- **Hover effects:** Subtle lift (translateY -2px) + shadow increase on cards
- **Transitions:** 300ms ease for data updates, 200ms for hover
- **Dark mode:** Not in v1; CSS custom properties used throughout for easy future theming

---

## 13. Error & Empty States

| Component | Empty State | Error State |
|-----------|-------------|-------------|
| Announcement banner | Hidden entirely | Hidden entirely |
| Pod tiles | Show pod name, stats show "—" | Show pod name, stats show "⚠" |
| Meetings | "No upcoming meetings" message | "Unable to load meetings" message |
| Bulletin board | "No news — must be a good day!" | "Unable to load bulletin" message |
| Team status | "No team members found" | "Unable to load statuses" message |
| Certified apps | Section hidden | Section hidden |
| Stickers | No visual indicator (empty is normal) | Silent fail, retry on next refresh |

---

## 14. Data Architecture

### 14.1 v1: Static JSON

All data lives in a single `dashboard-config.json` file served alongside the HTML:

```json
{
  "announcements": [
    { "id": "1", "text": "Welcome to ETS Dashboard!", "link": null, "active": true }
  ],
  "bulletin": [
    { "id": "1", "title": "Sprint Review Friday", "body": "Don't forget...", "createdAt": "2026-03-20T10:00:00Z" }
  ],
  "pods": [
    {
      "id": "ads",
      "shortName": "Ads",
      "fullName": "Ads",
      "color": "#3B82F6",
      "stats": { "incoming": 42, "throughput": 38, "teamSize": 8 }
    }
  ],
  "teamMembers": [
    {
      "id": "1",
      "name": "Jane Doe",
      "pod": "Ads",
      "status": "online",
      "statusMessage": "Heads down on sprint",
      "statusEmoji": "💻"
    }
  ],
  "meetings": [
    {
      "id": "1",
      "title": "ETS All Hands",
      "start": "2026-03-21T14:00:00Z",
      "durationMinutes": 60,
      "meetingLink": "https://meet.google.com/xxx",
      "attendees": ["Jane Doe", "John Smith"]
    }
  ],
  "certifiedApps": [
    { "id": "1", "name": "Champ", "url": "https://dash.champ.ai/app", "icon": "🏆" }
  ],
  "stickers": [],
  "admins": ["Eric Morin"],
  "settings": {
    "bannerColor": "#EF4444",
    "podColors": {
      "Ads": "#3B82F6",
      "Cat": "#22C55E",
      "Caper": "#F97316",
      "FaaS": "#8B5CF6",
      "FS": "#EF4444",
      "WL": "#14B8A6"
    }
  }
}
```

### 14.2 Future: Superblocks Integrations

| Data Source | Integration |
|-------------|-------------|
| Pod stats (tickets, throughput) | Superblocks → Jira API or Google Sheets/SmartSheets |
| Team meetings | Superblocks → Google Calendar API |
| Team member status | Superblocks → Slack API |
| Announcements | Superblocks → Slack channel (future) |
| Stickers | Superblocks datastore (already live in v1) |
| Analytics | Mode dashboards (embedded or linked) |

### 14.3 Connectivity Engine

Superblocks serves as the central API orchestration layer:
- Scheduled workflows poll external APIs at configurable intervals
- Results cached in Superblocks datastore
- Frontend fetches from Superblocks REST endpoints
- Near-real-time target achieved via short polling intervals (15s frontend + Superblocks workflow schedules)

---

## 15. Hosting

- **v1:** Superblocks App hosting (approved internally at Instacart)
- HTML/CSS/JS custom app deployed within Superblocks workspace
- Public access within Instacart (no auth gate for viewing)
- Future: credential-based viewing/editing via federated permissions

---

## 16. Responsive Behavior

- **Target:** Desktop full-screen (1440×900 minimum)
- **Approach:** CSS Grid with percentage-based columns, viewport height units
- **Below minimum:** Graceful degradation (internal scroll for all sections, stacked columns)
- **Mobile:** Not a v1 target; desktop-first

---

## Appendix: File Structure

```
ETS Dash/
├── .env                      # Superblocks API credentials (gitignored)
├── .gitignore
├── docs/
│   └── SPEC.md               # This document
├── public/
│   ├── index.html             # Main dashboard page
│   ├── pod.html               # Pod sub-page template
│   ├── css/
│   │   └── styles.css         # All styles
│   ├── js/
│   │   ├── app.js             # Main app logic, auto-refresh
│   │   ├── stickers.js        # Sticker/bubble system
│   │   ├── settings.js        # Settings panel logic
│   │   └── data.js            # Data layer (static JSON → Superblocks API)
│   └── data/
│       └── dashboard-config.json  # Static v1 data
└── .claude/
    ├── settings.local.json
    └── launch.json            # Dev server config
```
