# ETS Dashboard — Superblocks Migration Architecture

## Overview

Phase 2 migrates the ETS Dashboard from a static HTML/JS app to a Superblocks-hosted application backed by Supabase (Postgres), with Jira REST API integration for live metrics and Okta SSO for authentication.

```
┌─────────────────────────────────────────────────┐
│                  Superblocks                     │
│  ┌────────────┐  ┌──────────────────────────┐   │
│  │  App Pages │  │     Scheduled Workflow   │   │
│  │  (UI/UX)   │  │  refresh_pod_metrics.js  │   │
│  └─────┬──────┘  └──────────┬───────────────┘   │
└────────┼────────────────────┼───────────────────┘
         │                    │
    ┌────▼─────┐         ┌────▼──────────┐
    │ Supabase │         │  Jira REST    │
    │ Postgres │         │  API (PSO)    │
    └──────────┘         └───────────────┘
         │
    ┌────▼──────┐
    │   Okta    │
    │   SSO     │
    └───────────┘
```

---

## Data Sources to Create in Superblocks

### 1. Supabase (`SupabaseDB`)
- Type: Supabase
- Project URL: `<your-supabase-project-url>`
- Service Role Key: `<your-service-role-key>` (for workflows) OR anon key (for UI queries with RLS)

### 2. Jira REST API (`JiraAPI`)
- Type: REST API
- Base URL: `https://instacart.atlassian.net`
- Auth: Basic Authentication
  - Username: `eric.morin@instacart.com`
  - Password: `<JIRA_API_TOKEN>`

### 3. Okta SSO
- Type: OpenID Connect / SAML
- Provider: Okta
- Configure in Superblocks → Settings → Authentication
- Required claims: `email`, `name`, `groups` (for RBAC)

---

## App Pages

### Page 1: Home Dashboard (`/`)
Mirrors the current `index.html`. Contains:
- **Banner/Announcements strip** (reads from `announcements` table)
- **On-Call widget** (reads from a Supabase row or Opsgenie API)
- **Spotlight / TMOW** (reads latest row from `spotlight` table, ordered by `week_of DESC`)
- **Pod Cards grid** (reads from `pods` JOIN `pod_metrics` for current week)
- **Team Status panel** (reads from `team_members` ordered by pod)
- **Meetings widget** (reads from `meetings` table, upcoming only)
- **Bulletin Board** (reads from `bulletin_posts WHERE pod_id IS NULL`)
- **Certified Apps** (reads from `certified_apps WHERE pod_id IS NULL`)
- **Stickers layer** (reads from `stickers WHERE pod_id IS NULL`)

### Page 2: Pod Detail (`/pod/{podId}`)
Mirrors the current `pod.html`. One page per pod (use URL parameter). Contains:
- **Pod header** (pod name, icon, color from `pods`)
- **Weekly metrics chart** (reads last 7 weeks from `pod_metrics`)
- **Metric cards** (incoming, throughput, AHT, SLA%, breaches, escalations)
- **Team roster** (reads from `team_members WHERE pod_id = :podId`)
- **Pod Bulletin** (reads from `bulletin_posts WHERE pod_id = :podId`)
- **Pod Apps** (reads from `certified_apps WHERE pod_id = :podId`)
- **Pod Stickers** (reads from `stickers WHERE pod_id = :podId`)

### Page 3: Admin / Settings (management only)
- **Team Roster management** (full CRUD on `team_members`)
- **Pod configuration** (edit pod icon, color, Jira components)
- **Banner management** (edit `announcements`)
- **Manual metrics refresh** (trigger `refresh_pod_metrics` workflow)
- Restricted to users with `role = 'manager'` in `team_members`

---

## Scheduled Workflow: `refresh_pod_metrics`

**Purpose:** Pull weekly metrics from Jira PSO project and cache in Supabase.

**File:** `jira-metrics.js` (in this directory)

**Schedule:** Every Monday at 6:00 AM Pacific (cron: `0 14 * * 1`)

**Steps:**
1. **JavaScript** (`jira-metrics.js`) — fetches Jira data, returns metrics array
2. **Supabase Upsert** — writes to `pod_metrics` table
   - Conflict columns: `pod_id`, `week_start`
   - This is idempotent — safe to run multiple times

**Also trigger manually:** Add a button on the Admin page to run this workflow on-demand.

---

## Permission Model

### Superblocks Roles
| Role | Access |
|------|--------|
| Management | All pages, all write operations, admin settings |
| Pod Member | Home page (read) + their pod's detail page (write) |
| Read-only | Home page only (future: for stakeholders) |

### How to configure in Superblocks
1. Go to your App → Settings → Permissions
2. Create groups matching Okta groups: `ets-management`, `ets-ads`, `ets-cat`, etc.
3. Or use email-based rules matching the `admins` list from `dashboard-config.json`

### RLS in Supabase
The schema uses permissive RLS (authenticated = read all, write all) because Superblocks is the RBAC enforcement layer. The only exception: `pod_metrics` is write-protected to service role only (only the scheduled workflow can update it).

---

## Migration Checklist

### Preparation
- [ ] Create Supabase project at supabase.com
- [ ] Run `supabase-schema.sql` in Supabase SQL Editor
- [ ] Run `supabase-seed.sql` to populate initial data
- [ ] Verify WL pod Jira components with the WL pod lead (currently using OMS components as placeholder)
- [ ] Get Supabase project URL + anon key + service role key

### Superblocks Setup
- [ ] Log in to Superblocks (instacart org)
- [ ] Create new Application: "ETS Dashboard"
- [ ] Add data sources: Supabase, Jira REST API
- [ ] Configure Okta SSO
- [ ] Build Page 1 (Home) using Superblocks UI builder
  - [ ] Recreate pod cards with metric data from Supabase
  - [ ] Recreate bulletin board
  - [ ] Recreate TMOW spotlight with edit capability
  - [ ] Recreate team status panel
- [ ] Build Page 2 (Pod Detail) with URL parameter routing
- [ ] Build Page 3 (Admin) restricted to management group
- [ ] Create Workflow: `refresh_pod_metrics` with the JS code
- [ ] Test manual metrics refresh
- [ ] Set up weekly schedule for metrics refresh
- [ ] Validate all 6 pods' metrics appear correctly

### Cutover
- [ ] Share Superblocks app URL with the team
- [ ] Monitor for 1 week alongside old dashboard
- [ ] Decommission the old static dashboard

---

## Jira Component → Pod Mapping

| Pod ID | Short Name | Jira Component Pattern |
|--------|-----------|------------------------|
| `ads`   | Ads   | `Ads`, `Carrot Ads - *`, `Instacart Ads - *` |
| `cat`   | Cat   | `Catalog - *`, `Catalog TAM`, `Catalog Vending` |
| `caper` | Caper | `Caper - *`, `Caper *` (non-archived, 28 components) |
| `faas`  | FaaS  | `FaaS - *` (12 components) |
| `fs`    | FS    | `FoodStorm - *`, `Foodstorm - *` (60+ components) |
| `wl`    | WL    | `OMS *` — **⚠️ VERIFY with WL pod lead** |

**Note on WL:** There is no "White Label" component in the PSO project. The OMS (Order Management System) components are the best guess. Ask the WL pod lead to confirm.

---

## Jira Metrics Definitions

| Metric | Definition | Jira Query |
|--------|-----------|------------|
| **Incoming** | New tickets created this week | `created >= weekStart` |
| **Throughput** | Tickets resolved this week | `resolved >= weekStart` |
| **AHT** | Avg hours from ticket creation to resolution | `(resolutiondate - created)` average |
| **SLA%** | % of completed SLA cycles not breached | JSM `/request/{id}/sla` API |
| **Breaches** | Count of SLA cycles where `breached=true` | JSM SLA API |
| **Escalations** | Tickets with priority `P0` or `P1` | `priority in (P0, P1)` |

**AHT Note:** Calculated from `created` → `resolutiondate` (wall-clock time). For business-hours-only AHT, use the `elapsedTime.millis` from the JSM SLA API instead.

**SLA Note:** The PSO project has 2 SLA types: "1st response SLO" (40h goal) and "Mitig. Ready 4 Deploy" (320h goal). The dashboard currently reports a combined SLA% across both. If you want separate response vs. resolution SLA%, filter by SLA name.

---

## Key Technical Details

### Jira API Version
Use `/rest/api/3/search/jql` (v3) — the old `/rest/api/2/search` has been removed.
Response uses cursor pagination (`nextPageToken`, `isLast`) — there is no `total` field.

### SLA API
`GET /rest/servicedeskapi/request/{issueId}/sla`
Returns `completedCycles[]` with `breached: bool` and `elapsedTime.millis`.
This is a per-ticket call — the workflow samples up to 50 resolved tickets for SLA calculation.

### PSO Project Key
Jira project key is `PSO` (not "PSO-External" — that's the display name in the service desk portal).

### DiceBear Avatars
TMOW avatars use: `https://api.dicebear.com/7.x/{style}/svg?seed={name}`
8 available styles: `avataaars`, `bottts`, `lorelei`, `notionists`, `thumbs`, `fun-emoji`, `pixel-art`, `adventurer`
