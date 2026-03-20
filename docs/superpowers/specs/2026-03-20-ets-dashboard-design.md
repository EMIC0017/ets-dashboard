# ETS Dashboard — Design Specification

## Overview

A centralized, single-pane-of-glass dashboard for the ETS (Enterprise Technology Services) team at Instacart. Serves as a front page where team members can view current activities, team notifications, bulletin board content, and links to team-built apps.

## Platform & Hosting

- **Host:** Superblocks Application (internally approved)
- **Architecture:** Custom HTML/CSS/JS frontend within Superblocks, using Superblocks workflows as the backend data layer
- **Auth (v1):** Name prompt on first visit, stored in localStorage. Admin list defined in app config. Federated auth planned for future.

## Data Architecture

### v1: Static JSON Config

All data served from a static JSON configuration file within the Superblocks app. No external API calls on initial launch.

### Future: Superblocks Integrations

```
Superblocks Scheduled Workflows (poll every 15s)
    +-- Jira API --> pod stats (incoming tickets, throughput, team size)
    +-- Google Calendar API --> upcoming meetings
    +-- Slack API --> team member presence + custom status
    +-- SmartSheets / Mode --> ETS weekly metrics

Superblocks Datastore (key-value)
    +-- Announcements (manual entry via settings panel)
    +-- Stickers (persistent, per-user, with expiry)
    +-- Dashboard configuration (settings, color palette, admin list)
```

### Data Sources (when integrated)

| Source | Data | Integration |
|---|---|---|
| Jira | Pod stats (weekly tickets, throughput, team size) | Superblocks Jira integration |
| Google Calendar | Upcoming team meetings | Calendar ID: `c_eecaf4fdf56ce404ba7074068c8ed32ff3ce0eb0736907dd42876d906bec7901@group.calendar.google.com` |
| Slack | Team member presence + status + emoji | Superblocks Slack integration |
| SmartSheets | ETS weekly metrics | Superblocks SmartSheets integration |
| Mode | Analytics / reporting | Superblocks integration |

## Page Layout

Full-screen, no-scroll layout organized into horizontal zones.

```
+-----------------------------------------------------------+
|  ANNOUNCEMENT BANNER (bright accent, dismissible)         |
|-----------------------------------------------------------|
|                    Welcome to ETS                         |
+------------------+--------------------+-------------------+
|                  |                    |                   |
|   POD TILES      |   CENTER COLUMN    |  TEAM STATUS     |
|   (2x3 grid)    |                    |  WIDGET          |
|                  |  Upcoming Meetings |                   |
|  +------++------+|  (from GCal)      |  * Name [status] |
|  | Ads  || Cat  ||                   |  * Name [status] |
|  +------++------+|  ---------------  |  * Name [status] |
|  |Caper ||FaaS  ||                   |  ...              |
|  +------++------+|  News / Bulletin  |                   |
|  | FS   || WL   ||  Board            |                   |
|                  |                    |                   |
+------------------+--------------------+-------------------+
|  CERTIFIED TEAM APPS  [ Champ ] [ App2 ] [ App3 ] ...    |
+-----------------------------------------------------------+

  + Floating sticker bubbles (movable, anywhere on page)
  + Settings gear icon (top-right corner)
```

### Zone Sizes

- Left column (pod tiles): ~30% width
- Center column (meetings + bulletin): ~40% width
- Right column (team status): ~30% width
- Top banner: auto-height, collapsible when empty
- Bottom app strip: fixed height (~60px)

## Components

### 1. Announcement Banner

- Position: Top of page, full width
- Style: Bold background in bright accent color (configurable)
- Content: Text message, manually entered by admins via settings
- Behavior: Dismissible per-session. Hidden when no active announcement.

### 2. Welcome Header

- Text: "Welcome to ETS"
- Font: Rounded sans-serif (Poppins or Nunito)
- Position: Centered, below banner, above content columns

### 3. Pod Tiles (2x3 Grid)

Six pods, each represented as a card tile:

| Pod | Short Name | Default Color |
|---|---|---|
| Ads | Ads | Blue |
| Catalog | Cat | Green |
| Caper Carts | Caper | Orange |
| FaaS | FaaS | Purple |
| Foodstorm | FS | Red/Coral |
| White Label | WL | Teal |

**Card contents:**
- Pod short name (prominent)
- Three stat badges: incoming tickets (week), throughput (week), team size
- Distinct accent color per pod (border/header), configurable in settings

**Interactions:**
- Hover: Subtle lift animation + glow
- Click: Navigate to pod-specific sub-page

### 4. Center Column — Meetings & Bulletin

**Upcoming Meetings:**
- Displays next 3-5 meetings from Google Calendar
- Shows: meeting title, date/time, duration
- v1: Static data. Future: Google Calendar integration.

**Bulletin Board:**
- Free-form news, updates, important facts
- Managed via settings panel by admins

### 5. Team Status Widget

- List of team members with:
  - Presence dot: green (online), yellow (away), gray (offline)
  - Name
  - Custom status message + emoji
- v1: Static data. Future: Slack API presence integration.

### 6. Certified Team Apps Strip

- Horizontal row of app tiles/badges at bottom of page
- Each tile: app icon/logo + app name
- Click opens app in new tab
- First app: Champ (https://dash.champ.ai/app)
- Managed via settings panel by admins

### 7. Sticker Bubbles

- Floating, draggable circular bubbles overlaid on the page
- Placed via "+" button that opens a sticker/emoji picker
- Hover tooltip: placed by (name), placed at (timestamp)

**Lifecycle:**
- Default expiry: 24 hours after placement
- Admins can "persist" any sticker (removes expiry)
- Admins can "clear all" stickers from settings
- Admins have a sticker management table in settings: sticker icon, placed by, placed at, expires at, persistent toggle, delete button

**Storage:** Superblocks datastore. User identity from name prompt.

### 8. Settings Gear

- Icon: Top-right corner of the page
- Opens: Slide-out panel

**All users:**
- Toggle section visibility (banner, pods, status widget, apps strip)

**Admin-only (name matched against admin list in config):**
- Manage announcements (add/edit/remove)
- Manage certified app links (add/edit/remove URL, name, icon)
- Sticker management table (persist, clear all, delete individual)
- Pod color palette editor (color picker per pod)
- Edit admin list

## Pod Sub-Pages

Clicking a pod tile navigates to a sub-page scoped to that pod. Structure mirrors the main page:

- Pod name as page header
- Pod-specific announcements / bulletin
- Pod-specific upcoming meetings
- Pod team member statuses
- Back button to return to main dashboard

## Visual Design

- **Font:** Poppins or Nunito (rounded sans-serif, friendly feel)
- **Background:** Light neutral (off-white / very light gray)
- **Cards:** Subtle shadow, rounded corners
- **Banner:** Bold, bright accent color
- **Stickers:** Slight transparency, soft drop shadow, gentle bounce animation on placement
- **Transitions:** Smooth fade/slide for data updates, subtle hover lifts on interactive elements
- **Overall vibe:** Clean, modern, fun — not corporate-stuffy
- **Dark mode:** Not in v1. CSS variable architecture makes it easy to add later.

## Auto-Refresh

- 15-second polling interval via `setInterval`
- Smooth transitions when data changes (no full page reload)
- Last-refreshed timestamp visible (subtle, bottom corner or near settings gear)

## Auth & Permissions

### v1

- First visit: prompt for name, stored in localStorage
- Admin detection: name matched against admin list in JSON config
- All users can view dashboard, place stickers, toggle personal display settings
- Admins can manage announcements, apps, stickers, colors

### Future

- Federated auth via Instacart SSO
- Role-based permissions (viewer, editor, admin)
- Per-pod admin roles

## Future Integrations

| Feature | Current (v1) | Future |
|---|---|---|
| Pod stats | Static JSON | Jira API via Superblocks |
| Meetings | Static JSON | Google Calendar API |
| Team status | Static JSON | Slack API (presence + status) |
| Announcements | Manual (settings) | Slack channel integration |
| Metrics | Static JSON | SmartSheets + Mode |
| Auth | Name prompt | Federated SSO |
| Hosting | Superblocks | Superblocks (no change) |

## Configuration Schema (v1 static data)

```json
{
  "announcements": [
    { "id": "1", "text": "Welcome to the new ETS Dashboard!", "active": true }
  ],
  "pods": [
    {
      "id": "ads",
      "name": "Ads",
      "shortName": "Ads",
      "color": "#3B82F6",
      "stats": {
        "incomingTickets": 24,
        "throughput": 18,
        "teamSize": 12
      }
    }
  ],
  "meetings": [
    {
      "title": "ETS Weekly Standup",
      "datetime": "2026-03-23T10:00:00-07:00",
      "duration": "30m"
    }
  ],
  "teamMembers": [
    {
      "name": "Jane Doe",
      "status": "online",
      "customStatus": "Heads down on sprint",
      "emoji": "keyboard"
    }
  ],
  "certifiedApps": [
    {
      "name": "Champ",
      "url": "https://dash.champ.ai/app",
      "icon": "trophy"
    }
  ],
  "admins": ["Eric Morin"],
  "podColors": {
    "ads": "#3B82F6",
    "cat": "#10B981",
    "caper": "#F97316",
    "faas": "#8B5CF6",
    "fs": "#EF4444",
    "wl": "#14B8A6"
  }
}
```
