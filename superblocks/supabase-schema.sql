-- ============================================================
-- ETS Dashboard — Supabase Schema
-- Run this in the Supabase SQL Editor for a fresh project
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- PODS (replaces pods[] in dashboard-config.json)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pods (
  id            TEXT PRIMARY KEY,          -- 'ads', 'cat', 'caper', 'faas', 'fs', 'wl'
  short_name    TEXT NOT NULL,             -- 'Ads', 'Cat', etc.
  full_name     TEXT NOT NULL,             -- 'Ads / Emerging', 'Catalog', etc.
  icon          TEXT DEFAULT '📦',
  color         TEXT DEFAULT '#64748B',    -- hex color
  slack_channel_id TEXT,
  -- Jira component names that belong to this pod (used in JQL queries)
  jira_components TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- TEAM MEMBERS (replaces teamMembers[] in dashboard-config.json)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  pod_id        TEXT REFERENCES pods(id),
  role          TEXT DEFAULT 'member',     -- 'member', 'senior', 'manager'
  title         TEXT,
  slack_id      TEXT,
  status        TEXT DEFAULT 'online',     -- 'online', 'away', 'busy', 'offline'
  status_message TEXT DEFAULT '',
  status_emoji  TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- POD METRICS CACHE (pre-aggregated from Jira, refreshed weekly)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pod_metrics (
  id               SERIAL PRIMARY KEY,
  pod_id           TEXT NOT NULL REFERENCES pods(id),
  week_start       DATE NOT NULL,           -- Monday of the week (ISO)
  incoming         INT DEFAULT 0,           -- new tickets created this week
  throughput       INT DEFAULT 0,           -- tickets resolved this week
  aht_hours        NUMERIC(6,2) DEFAULT 0,  -- avg handle time in hours (created→resolved)
  response_sla_pct NUMERIC(5,2) DEFAULT 0,  -- % of 1st response SLO met
  resolution_sla_pct NUMERIC(5,2) DEFAULT 0, -- % of resolution SLA met
  total_breaches   INT DEFAULT 0,           -- SLA cycles where breached=true this week
  total_escalations INT DEFAULT 0,          -- P0+P1 tickets this week
  last_refreshed   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pod_id, week_start)
);

-- ─────────────────────────────────────────────────────────────
-- SPOTLIGHT / TEAM MEMBER OF THE WEEK
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spotlight (
  id          SERIAL PRIMARY KEY,
  type        TEXT DEFAULT 'teamMember',
  title       TEXT DEFAULT 'Team Member of the Week',
  name        TEXT NOT NULL,
  pod         TEXT,
  avatar      TEXT,                         -- DiceBear URL or custom image URL
  message     TEXT,
  week_of     DATE DEFAULT CURRENT_DATE,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- BULLETIN POSTS (global + pod-scoped)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bulletin_posts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pod_id          TEXT REFERENCES pods(id), -- NULL = global bulletin board
  title           TEXT NOT NULL,
  body            TEXT,
  author          TEXT NOT NULL,
  highlight_color TEXT,                     -- CSS background color for highlighted posts
  text_color      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- ANNOUNCEMENTS (the rolling banner)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text        TEXT NOT NULL,
  link        TEXT,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- STICKY NOTES / STICKERS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stickers (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pod_id      TEXT REFERENCES pods(id),     -- NULL = global board
  content     TEXT NOT NULL,
  x           NUMERIC NOT NULL DEFAULT 100,
  y           NUMERIC NOT NULL DEFAULT 100,
  color       TEXT DEFAULT '#FEF9C3',       -- CSS background color
  author      TEXT NOT NULL,
  persistent  BOOLEAN DEFAULT false,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- CERTIFIED APPS (global + pod-scoped)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS certified_apps (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pod_id      TEXT REFERENCES pods(id),     -- NULL = global apps
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  icon        TEXT DEFAULT '🔗',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- POD SETTINGS (background, meme image, etc.)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pod_settings (
  pod_id        TEXT PRIMARY KEY REFERENCES pods(id),
  bg_color      TEXT,
  bg_image_url  TEXT,
  meme_url      TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- MEETINGS (upcoming meetings widget)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meetings (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title            TEXT NOT NULL,
  start_time       TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 60,
  meeting_link     TEXT,
  attendees        TEXT[],                  -- e.g. ['All ETS'], ['Pod Leads']
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- Enable after testing — requires Okta/Supabase auth integration
-- ─────────────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE pods             ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_metrics      ENABLE ROW LEVEL SECURITY;
ALTER TABLE spotlight        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulletin_posts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE stickers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE certified_apps   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings         ENABLE ROW LEVEL SECURITY;

-- Read: all authenticated users can read everything
CREATE POLICY "auth_read_all" ON pods             FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_all" ON team_members     FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_all" ON pod_metrics      FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_all" ON spotlight        FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_all" ON bulletin_posts   FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_all" ON announcements    FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_all" ON stickers         FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_all" ON certified_apps   FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_all" ON pod_settings     FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_all" ON meetings         FOR SELECT TO authenticated USING (true);

-- Write: authenticated users can insert/update/delete
-- (Superblocks handles role-based access control on top of this via its own permissions layer)
CREATE POLICY "auth_write_all" ON bulletin_posts   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_all" ON stickers         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_all" ON spotlight        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_all" ON announcements    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_all" ON team_members     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_all" ON pod_settings     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_all" ON certified_apps   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write_all" ON meetings         FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Metrics: only service role can write (updated by scheduled workflow, not users)
CREATE POLICY "service_write_metrics" ON pod_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_write_pods"    ON pods        FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- HELPER: auto-update updated_at on team_members
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER pod_settings_updated_at
  BEFORE UPDATE ON pod_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
