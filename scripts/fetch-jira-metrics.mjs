/**
 * fetch-jira-metrics.mjs
 *
 * Queries Jira for all 6 ETS pods and writes public/data/metrics.json.
 * Run by GitHub Actions on a schedule; never runs in the browser.
 *
 * Required env vars:
 *   JIRA_BASE_URL   — https://instacart.atlassian.net
 *   JIRA_EMAIL      — your Atlassian account email
 *   JIRA_API_TOKEN  — Atlassian API token
 *   JIRA_PROJECT    — Jira project key (default: PSO)
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────

const JIRA_BASE    = process.env.JIRA_BASE_URL  || 'https://instacart.atlassian.net';
const JIRA_EMAIL   = process.env.JIRA_EMAIL;
const JIRA_TOKEN   = process.env.JIRA_API_TOKEN;
const JIRA_PROJECT = process.env.JIRA_PROJECT   || 'PSO';

if (!JIRA_EMAIL || !JIRA_TOKEN) {
  console.error('JIRA_EMAIL and JIRA_API_TOKEN are required');
  process.exit(1);
}

// ── SLA Targets ───────────────────────────────────────────────────────────────
//
// Resolution SLA: maximum hours from creation to resolution per priority.
// Adjust these to match your team's actual SLA commitments.
//
const RESOLUTION_SLA_HOURS = {
  'Highest':  4,    // P1 / Critical
  'High':     24,   // P2 — 1 business day
  'Medium':   72,   // P3 — 3 business days
  'Low':      168,  // P4 — 1 week
  'Lowest':   336,  // P5 — 2 weeks
};

// Open ticket age (hours) before it counts as an escalation on the card
const ESCALATION_HOURS = {
  'Highest':  2,
  'High':     8,
  'Medium':   48,
  'Low':      96,
  'Lowest':   200,
};

// ── Pod definitions (mirrors Supabase pods table) ─────────────────────────────

const PODS = [
  {
    id: 'ads',
    components: ['Ads','Carrot Ads - API','Carrot Ads - Access Request','Carrot Ads - Accounts',
      'Carrot Ads - Ad Serving APIs','Carrot Ads - Ad Spending','Carrot Ads - Catalog',
      'Carrot Ads - Collections','Carrot Ads - Data Engineering','Carrot Ads - Metrics',
      'Carrot Ads - Other','Carrot Ads - UI','Instacart Ads - Ads Manager API',
      'Instacart Ads - Ads Manager UI'],
  },
  {
    id: 'caper',
    components: ['Caper - Network','Caper - Operational','Caper - Retailer','Caper - Technical',
      'Caper Backend (Backend Pillar)','Caper Barcode Creation','Caper Bulk Closure',
      'Caper Cart Manager Credentials','Caper Catalog','Caper Configurations','Caper Crash/ANR',
      'Caper Deployment','Caper Feature Enablement','Caper Feature Request',
      'Caper Hardware (HSI Pillar)','Caper IoT Platform (Caper Cloud)',
      'Caper Loyalty & Coupons(Value Pillar)','Caper NOF','Caper Network Connectivity',
      'Caper Offline Alert','Caper Others','Caper Report (IPP)',
      'Caper Retailer Tools (Cart Manager or Audits)',
      'Caper Scanning (Camera Vision CV Pillar) ','Caper Shopping Experience (Android Pillar)',
      'Caper UPOS','Caper ZBC/Network/Location (Locations Pillar)','Caper Zero Orders'],
  },
  {
    id: 'cat',
    components: ['Catalog - Automated Emails','Catalog - Availability issue',
      'Catalog - Category / department issue','Catalog - Duplicated items',
      'Catalog - External','Catalog - Internal','Catalog - Move to In-house',
      'Catalog - Private label','Catalog - Product creation','Catalog - Product scanning',
      'Catalog - Tags','Catalog TAM','Catalog Vending'],
  },
  {
    id: 'faas',
    components: ['FaaS - Bypass','FaaS - Catalog Issues','FaaS - Connect Callbacks ',
      'FaaS - Connect Endpoint','FaaS - Customer Account','FaaS - IPP','FaaS - LMD',
      'FaaS - Order Questions','FaaS - Others','FaaS - Retailer Error',
      'FaaS - Retailer Testing','FaaS - Store Setup'],
  },
  {
    id: 'fs',
    components: ['FoodStorm - Account Changes','FoodStorm - Admin UI Issue','FoodStorm - Barcodes',
      'FoodStorm - CSM','FoodStorm - Catalog','FoodStorm - Closures & Time Blocks',
      'FoodStorm - Communications - Emails','FoodStorm - Communications - SMS',
      'FoodStorm - Feature Request','FoodStorm - Fulfillment Issues','FoodStorm - General Inquiry',
      'FoodStorm - Hardware Devices - EloView','FoodStorm - Hardware Devices - Kiosks',
      'FoodStorm - Hardware Devices - Printers','FoodStorm - Integrations - Accounting',
      'FoodStorm - Integrations - Fulfilment','FoodStorm - Integrations - Other',
      'FoodStorm - Integrations - POS','FoodStorm - Items - Creation','FoodStorm - Items - Item Sets',
      'FoodStorm - Items - Update','FoodStorm - Jobs - Export','FoodStorm - Jobs - Import',
      'FoodStorm - LMD Changes','FoodStorm - Orders - Order Completion',
      'FoodStorm - Orders - Order Creation','FoodStorm - Orders - Order Update',
      'FoodStorm - Other','FoodStorm - Payments - Other','FoodStorm - Payments - Refunds',
      'FoodStorm - Payments - Unexpected Charges','FoodStorm - Printing',
      'FoodStorm - Promotions','FoodStorm - Reports - New Build',
      'FoodStorm - Reports - Reports Generation','FoodStorm - SFTP','FoodStorm - SSL/Certificates',
      'FoodStorm - SSO','FoodStorm - Server Errors','FoodStorm - Service Options - Delivery',
      'FoodStorm - Shopping Cart','FoodStorm - Staff','FoodStorm - UI Changes',
      'FoodStorm - User Identity and Privacy - Access','FoodStorm - Voicemails',
      'FoodStorm - Website builder','Foodstorm - Hybrid Sync','Foodstorm - Items API'],
  },
  {
    id: 'wl',
    components: ['OMS Callback Errors','OMS Catalog','OMS Orders','OMS Reports','OMS ServiceOptions'],
  },
];

// ── Jira helpers ──────────────────────────────────────────────────────────────

const AUTH = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');

async function jiraSearch(jql, fields = 'summary,status,priority,created,resolutiondate', maxResults = 500) {
  const url = `${JIRA_BASE}/rest/api/3/search`;
  let startAt = 0;
  let all = [];

  while (true) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${AUTH}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ jql, fields: fields.split(','), maxResults, startAt }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Jira API ${res.status}: ${err}`);
    }

    const data = await res.json();
    all = all.concat(data.issues || []);
    if (all.length >= data.total || (data.issues || []).length === 0) break;
    startAt += data.issues.length;
  }

  return all;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function mondayOf(date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function last8Weeks() {
  const weeks = [];
  const monday = mondayOf(new Date());
  for (let i = 7; i >= 0; i--) {
    const start = new Date(monday);
    start.setUTCDate(monday.getUTCDate() - i * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 7);
    weeks.push({ start, end });
  }
  return weeks;
}

function weekLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function hoursBetween(a, b) {
  return Math.abs(new Date(b) - new Date(a)) / 36e5;
}

// ── Per-pod metric calculation ────────────────────────────────────────────────

async function fetchPodMetrics(pod) {
  const weeks = last8Weeks();
  const windowStart = weeks[0].start.toISOString().split('T')[0];
  const compList = pod.components.map(c => `"${c.replace(/"/g, '\\"')}"`).join(',');
  const baseJql = `project = "${JIRA_PROJECT}" AND component in (${compList})`;

  console.log(`  querying ${pod.id}...`);

  const [created, openTickets] = await Promise.all([
    jiraSearch(
      `${baseJql} AND created >= "${windowStart}" ORDER BY created ASC`,
      'summary,status,priority,created,resolutiondate'
    ),
    jiraSearch(
      `${baseJql} AND statusCategory != Done ORDER BY created ASC`,
      'summary,status,priority,created'
    ),
  ]);

  const resolved = created.filter(i => i.fields.resolutiondate);

  // Weekly buckets
  const weeklyIncoming = weeks.map(w =>
    created.filter(i => {
      const d = new Date(i.fields.created);
      return d >= w.start && d < w.end;
    }).length
  );

  const weeklyThroughput = weeks.map(w =>
    resolved.filter(i => {
      const d = new Date(i.fields.resolutiondate);
      return d >= w.start && d < w.end;
    }).length
  );

  const weeklyAHT = weeks.map(w => {
    const resolvedInWeek = resolved.filter(i => {
      const d = new Date(i.fields.resolutiondate);
      return d >= w.start && d < w.end;
    });
    if (resolvedInWeek.length === 0) return 0;
    const total = resolvedInWeek.reduce((sum, i) =>
      sum + hoursBetween(i.fields.created, i.fields.resolutiondate), 0);
    return Math.round((total / resolvedInWeek.length) * 10) / 10;
  });

  // Resolution SLA %: resolved tickets within target time
  let slaOnTime = 0;
  let slaTotal  = 0;
  for (const issue of resolved) {
    const priority = issue.fields.priority?.name || 'Medium';
    const target   = RESOLUTION_SLA_HOURS[priority] ?? 72;
    const actual   = hoursBetween(issue.fields.created, issue.fields.resolutiondate);
    slaTotal++;
    if (actual <= target) slaOnTime++;
  }
  const resolutionSLA = slaTotal > 0 ? Math.round((slaOnTime / slaTotal) * 100) : null;

  // Breaches and escalations from currently open tickets
  let totalBreaches = 0;
  let totalEscalations = 0;
  const now = new Date();
  for (const issue of openTickets) {
    const priority    = issue.fields.priority?.name || 'Medium';
    const ageHours    = hoursBetween(issue.fields.created, now);
    const slaTarget   = RESOLUTION_SLA_HOURS[priority] ?? 72;
    const escalTarget = ESCALATION_HOURS[priority] ?? 48;
    if (ageHours > slaTarget)   totalBreaches++;
    if (ageHours > escalTarget) totalEscalations++;
  }

  return {
    weeklyIncoming,
    weeklyThroughput,
    weeklyAHT,
    responseSLA:      null,
    resolutionSLA,
    totalBreaches,
    totalEscalations,
    openCount:        openTickets.length,
    weeks:            weeks.map(w => weekLabel(w.start)),
    fetchedAt:        new Date().toISOString(),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching Jira metrics for all ETS pods...\n');
  const output = { generatedAt: new Date().toISOString(), pods: {} };

  for (const pod of PODS) {
    try {
      output.pods[pod.id] = await fetchPodMetrics(pod);
      console.log(`  done: ${pod.id}`);
    } catch (err) {
      console.error(`  error: ${pod.id} — ${err.message}`);
      output.pods[pod.id] = { error: err.message };
    }
  }

  const outPath = join(__dirname, '..', 'public', 'data', 'metrics.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nWritten: ${outPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });
