-- ============================================================
-- ETS Dashboard — Supabase Seed Data
-- Run AFTER supabase-schema.sql
-- Migrated from public/data/dashboard-config.json
-- ============================================================

-- ─── PODS ─────────────────────────────────────────────────
INSERT INTO pods (id, short_name, full_name, icon, color, slack_channel_id, jira_components) VALUES
  ('ads',   'Ads',   'Ads / Emerging',  '📢', '#3B82F6', 'C073V4FR1DE', ARRAY[
    'Ads', 'Carrot Ads - API', 'Carrot Ads - Access Request', 'Carrot Ads - Accounts',
    'Carrot Ads - Ad Serving APIs', 'Carrot Ads - Ad Spending', 'Carrot Ads - Catalog',
    'Carrot Ads - Collections', 'Carrot Ads - Data Engineering', 'Carrot Ads - Metrics',
    'Carrot Ads - Other', 'Carrot Ads - UI',
    'Instacart Ads - Ads Manager API', 'Instacart Ads - Ads Manager UI'
  ]),
  ('cat',   'Cat',   'Catalog',         '📚', '#22C55E', NULL, ARRAY[
    'Catalog - Automated Emails', 'Catalog - Availability issue',
    'Catalog - Category / department issue', 'Catalog - Duplicated items',
    'Catalog - External', 'Catalog - Internal', 'Catalog - Move to In-house',
    'Catalog - Private label', 'Catalog - Product creation', 'Catalog - Product scanning',
    'Catalog - Tags', 'Catalog TAM', 'Catalog Vending'
  ]),
  ('caper', 'Caper', 'Caper Carts',     '🛒', '#F97316', 'C05L86U993N', ARRAY[
    'Caper - Network', 'Caper - Operational', 'Caper - Retailer', 'Caper - Technical',
    'Caper Backend (Backend Pillar)', 'Caper Barcode Creation', 'Caper Bulk Closure',
    'Caper Cart Manager Credentials', 'Caper Catalog', 'Caper Configurations',
    'Caper Crash/ANR', 'Caper Deployment', 'Caper Feature Enablement',
    'Caper Feature Request', 'Caper Hardware (HSI Pillar)', 'Caper IoT Platform (Caper Cloud)',
    'Caper Loyalty & Coupons(Value Pillar)', 'Caper NOF', 'Caper Network Connectivity',
    'Caper Offline Alert', 'Caper Others', 'Caper Report (IPP)',
    'Caper Retailer Tools (Cart Manager or Audits)',
    'Caper Scanning (Camera Vision CV Pillar) ',
    'Caper Shopping Experience (Android Pillar)',
    'Caper UPOS', 'Caper ZBC/Network/Location (Locations Pillar)', 'Caper Zero Orders'
  ]),
  ('faas',  'FaaS',  'Fulfillment',     '☁️', '#8B5CF6', 'C060VQ316KT', ARRAY[
    'FaaS - Bypass', 'FaaS - Catalog Issues', 'FaaS - Connect Callbacks ',
    'FaaS - Connect Endpoint', 'FaaS - Customer Account', 'FaaS - IPP',
    'FaaS - LMD', 'FaaS - Order Questions', 'FaaS - Others',
    'FaaS - Retailer Error', 'FaaS - Retailer Testing', 'FaaS - Store Setup'
  ]),
  ('fs',    'FS',    'Foodstorm',       '🍽️', '#EF4444', 'C077P6VE9EE', ARRAY[
    'FoodStorm - Account Changes', 'FoodStorm - Admin UI Issue', 'FoodStorm - Barcodes',
    'FoodStorm - CSM', 'FoodStorm - Catalog', 'FoodStorm - Closures & Time Blocks',
    'FoodStorm - Communications - Emails', 'FoodStorm - Communications - SMS',
    'FoodStorm - Contacts - Add / Edit Contact or Company',
    'FoodStorm - Documents - Document Templates', 'FoodStorm - Domain Issues',
    'FoodStorm - Feature Request', 'FoodStorm - Fulfillment Issues',
    'FoodStorm - General Inquiry', 'FoodStorm - Hardware Devices - EloView',
    'FoodStorm - Hardware Devices - Kiosks', 'FoodStorm - Hardware Devices - Printers',
    'FoodStorm - Integrations - Accounting', 'FoodStorm - Integrations - Fulfilment',
    'FoodStorm - Integrations - Other', 'FoodStorm - Integrations - POS',
    'FoodStorm - Integrations - Payment Gatweway', 'FoodStorm - Integrations - SFP',
    'FoodStorm - Items - Creation', 'FoodStorm - Items - Item Sets',
    'FoodStorm - Items - Quantity Limits', 'FoodStorm - Items - Update',
    'FoodStorm - Jobs - Export', 'FoodStorm - Jobs - Import',
    'FoodStorm - LMD Changes', 'FoodStorm - Labs', 'FoodStorm - Marketing',
    'FoodStorm - Orders - Order Completion', 'FoodStorm - Orders - Order Creation',
    'FoodStorm - Orders - Order Update', 'FoodStorm - Orders - Recurring Orders',
    'FoodStorm - Other', 'FoodStorm - Payments - Other', 'FoodStorm - Payments - Refunds',
    'FoodStorm - Payments - Unexpected Charges', 'FoodStorm - Printing',
    'FoodStorm - Promotions', 'FoodStorm - Reports - Modifications',
    'FoodStorm - Reports - New Build', 'FoodStorm - Reports - Report Schedules - Emails',
    'FoodStorm - Reports - Report Schedules - SFTP', 'FoodStorm - Reports - Reports Generation',
    'FoodStorm - SFTP', 'FoodStorm - SSL/Certificates', 'FoodStorm - SSO',
    'FoodStorm - Server Errors', 'FoodStorm - Service Options - Delivery',
    'FoodStorm - Shopping Cart', 'FoodStorm - Staff', 'FoodStorm - UI Changes',
    'FoodStorm - User Identity and Privacy - Access',
    'FoodStorm - User Identity and Privacy - Account Creation/Deletion',
    'FoodStorm - User Identity and Privacy - Others',
    'FoodStorm - User Identity and Privacy - Sign-on Issues',
    'FoodStorm - Voicemails', 'FoodStorm - Website builder',
    'Foodstorm - Hybrid Sync', 'Foodstorm - Items API'
  ]),
  ('wl',    'WL',    'White Label',     '🏷️', '#14B8A6', 'C073676HT5H', ARRAY[
    -- TODO: Verify correct Jira components for WL pod
    -- Likely OMS-related components:
    'OMS Callback Errors', 'OMS Catalog', 'OMS Orders', 'OMS Reports', 'OMS ServiceOptions'
  ])
ON CONFLICT (id) DO NOTHING;

-- ─── POD SETTINGS (empty stubs) ───────────────────────────
INSERT INTO pod_settings (pod_id) VALUES
  ('ads'), ('cat'), ('caper'), ('faas'), ('fs'), ('wl')
ON CONFLICT (pod_id) DO NOTHING;

-- ─── TEAM MEMBERS ─────────────────────────────────────────
INSERT INTO team_members (id, name, pod_id, role, title, slack_id) VALUES
  -- Management
  (gen_random_uuid(), 'Eric Morin',          NULL,    'manager', 'Senior Manager, Enterprise Technical Support',         'U08744QQE0K'),
  (gen_random_uuid(), 'Nikita Patrachari',   NULL,    'manager', 'Senior Project Manager, Enterprise Technical Support', 'U06DZ7DRNH4'),
  (gen_random_uuid(), 'Alicia Horton',       NULL,    'manager', 'Lead, Enterprise Technical Support',                   'U042JLLDHJ9'),
  (gen_random_uuid(), 'Jonathan Bloomfield', NULL,    'manager', 'Manager, Enterprise Technical Support',                'U014SBQRBU4'),
  (gen_random_uuid(), 'Sudhanshu Chugh',     NULL,    'manager', 'Lead, Enterprise Technical Support',                   'U01N3JRP2LS'),
  (gen_random_uuid(), 'Hassan Javaid',       NULL,    'manager', 'Manager, Enterprise Technical Support',                'U021AQH002J'),
  -- Ads pod
  (gen_random_uuid(), 'Harshjot Gahunia',    'ads',   'member',  'Technical Support Engineer',   'U09M43NJ5V4'),
  (gen_random_uuid(), 'Niraj Patel',         'ads',   'member',  'Technical Support Engineer',   'U07GJEKC5P0'),
  -- Cat pod
  (gen_random_uuid(), 'Nathan Abraham',      'cat',   'member',  'Technical Support Specialist II', 'U06MLP75YM6'),
  (gen_random_uuid(), 'Hayden Kim',          'cat',   'member',  'Technical Support Specialist II', 'U072DJ67SF4'),
  (gen_random_uuid(), 'Maryna Kostiuk',      'cat',   'member',  'Catalog Analyst',                 'U08KKC3CYG2'),
  (gen_random_uuid(), 'Ali Zaidi',           'cat',   'member',  'Catalog Analyst',                 'U080XEXD37T'),
  (gen_random_uuid(), 'Arpreet Arora',       'cat',   'member',  'Technical Support Engineer',      'U082U3BD8G1'),
  (gen_random_uuid(), 'Avneet Taneja',       'cat',   'member',  'Catalog Analyst',                 'U07TDGRA4R4'),
  (gen_random_uuid(), 'Cecilia Tse',         'cat',   'member',  'Catalog Administrator',           'U08R3DGNEJZ'),
  (gen_random_uuid(), 'Omaid Nadi',          'cat',   'member',  'Technical Support Engineer',      'U09BWSM3PPF'),
  -- Caper pod
  (gen_random_uuid(), 'Patrick Tan',         'caper', 'member',  'Technical Support Engineer', 'U08T5HTMYLV'),
  (gen_random_uuid(), 'Gabriel Sliwowicz',   'caper', 'member',  'Technical Support Engineer', 'U09PVHK1JCQ'),
  (gen_random_uuid(), 'Alicia Webber',       'caper', 'member',  'Technical Support Engineer', NULL),
  (gen_random_uuid(), 'Aneeq Nasir',         'caper', 'member',  'Technical Support Engineer', 'U09RF82C5FX'),
  (gen_random_uuid(), 'Abdullah Mohammed',   'caper', 'member',  'Technical Support Engineer', 'U0A7BSJSDU6'),
  (gen_random_uuid(), 'Jack Lowry',          'caper', 'member',  'Technical Support Engineer', 'U0AG4KJF5UH'),
  (gen_random_uuid(), 'Tommy Otis',          'caper', 'member',  'Technical Support Engineer', 'U0AFRLBEV6E'),
  (gen_random_uuid(), 'Kishore Bobba',       'caper', 'member',  'Technical Support Engineer', 'U07DY21LE4R'),
  (gen_random_uuid(), 'Sahil Khan',          'caper', 'member',  'Technical Support Engineer', 'U093Y1H9EB1'),
  (gen_random_uuid(), 'Shafeeq Zaman',       'caper', 'member',  'Technical Support Engineer', 'U0AMAKEKXFB'),
  -- FaaS pod
  (gen_random_uuid(), 'Chandan Kaushal',     'faas',  'member',  'Technical Support Engineer',     'U05SUQG1LDR'),
  (gen_random_uuid(), 'Titus Andersen',      'faas',  'member',  'Technical Support Engineer',     'U042F1DQCNA'),
  (gen_random_uuid(), 'Maximus Cresswell',   'faas',  'member',  'Technical Support Engineer',     'U09TMQJRDJL'),
  (gen_random_uuid(), 'Salman Ijaz',         'faas',  'member',  'Technical Support Engineer',     'U07U83GDX50'),
  (gen_random_uuid(), 'John Aba',            'faas',  'member',  'Technical Support Engineer',     'U08TRKG367R'),
  (gen_random_uuid(), 'Graham McGregor',     'faas',  'senior',  'Senior Software Engineer',       'U096QAUR1U1'),
  -- FS pod
  (gen_random_uuid(), 'Shravan Kumar',       'fs',    'member',  'Technical Support Engineer',        'U07FH1B3YN9'),
  (gen_random_uuid(), 'Nandini Patel',       'fs',    'member',  'Technical Support Engineer',        'U068DE58NNA'),
  (gen_random_uuid(), 'Jaivin James',        'fs',    'member',  'Technical Support Engineer',        'U08GWT6QZEJ'),
  (gen_random_uuid(), 'Gage Maher',          'fs',    'senior',  'Senior Technical Support Engineer', 'U02C2LZ6T1Q'),
  (gen_random_uuid(), 'Harsh Mehta',         'fs',    'member',  'Technical Support Engineer',        NULL),
  -- WL pod
  (gen_random_uuid(), 'Artem Korottchenko',  'wl',    'senior',  'Senior Technical Support Engineer', 'U01QTAE9RBR'),
  (gen_random_uuid(), 'Bilal Rizvi',         'wl',    'member',  'Technical Support Engineer',        'U05C4NRSC82'),
  (gen_random_uuid(), 'Chris Jin',           'wl',    'member',  'Technical Support Engineer',        'U02MDJ8PW1Z'),
  (gen_random_uuid(), 'Sahil Saluja',        'wl',    'member',  'Technical Support Engineer',        'U09GBMRQETA'),
  (gen_random_uuid(), 'Madhuri Surve',       'wl',    'member',  'Technical Support Engineer',        'U06TC9ARKAN'),
  (gen_random_uuid(), 'Sofia Salgado',       'wl',    'member',  'Technical Support Engineer',        'U0A2FM446MU'),
  (gen_random_uuid(), 'Yaseen Lambe',        'wl',    'member',  'Technical Support Engineer',        'U09EWUKM6P9')
ON CONFLICT DO NOTHING;

-- ─── SPOTLIGHT (current TMOW) ─────────────────────────────
INSERT INTO spotlight (type, title, name, pod, avatar, message, week_of) VALUES
  ('teamMember', 'Team Member of the Week', 'Niraj Patel', 'Ads',
   'https://api.dicebear.com/7.x/avataaars/svg?seed=NirajPatel',
   'For shipping the first Claude skill (ets-pso-resolution) to the Instacart marketplace — automating PSO ticket resolutions!',
   CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- ─── ANNOUNCEMENTS ────────────────────────────────────────
INSERT INTO announcements (text, active) VALUES
  ('Welcome to the new ETS Dashboard! Explore your pod, check out team stats, and drop a sticker.', true)
ON CONFLICT DO NOTHING;

-- ─── CERTIFIED APPS (global) ──────────────────────────────
INSERT INTO certified_apps (pod_id, name, url, icon) VALUES
  (NULL, 'Champ',       'https://dash.champ.ai/app', '🏆'),
  (NULL, 'Jira Board',  'https://instacart.atlassian.net/jira/dashboards/17758', '📋'),
  (NULL, 'ETS Metrics', 'https://docs.google.com/spreadsheets/d/1dnYtOxEtPEyaok_lg8UGMNaNvqmC9Sum9NY_s02i5gU/edit', '📊'),
  (NULL, 'Status Page', 'https://enterprise-status.instacart.com/', '🟢')
ON CONFLICT DO NOTHING;

-- ─── MEETINGS ─────────────────────────────────────────────
INSERT INTO meetings (title, start_time, duration_minutes, meeting_link, attendees) VALUES
  ('ETS All Hands',   '2026-03-21T14:00:00Z', 60, 'https://meet.google.com/ets-allhands', ARRAY['All ETS']),
  ('Pod Leads Sync',  '2026-03-22T16:00:00Z', 30, 'https://meet.google.com/pod-leads',    ARRAY['Pod Leads']),
  ('Sprint Review',   '2026-03-24T18:00:00Z', 45, 'https://meet.google.com/sprint-review', ARRAY['All ETS'])
ON CONFLICT DO NOTHING;
