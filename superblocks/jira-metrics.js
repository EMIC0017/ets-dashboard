/**
 * ETS Dashboard — Jira Metrics Aggregation
 *
 * This module is designed to run as a Superblocks Workflow (JavaScript step)
 * on a weekly schedule. It fetches PSO ticket data from Jira and writes
 * aggregated metrics to the Supabase pod_metrics table.
 *
 * SETUP IN SUPERBLOCKS:
 *   1. Create a REST API data source named "JiraAPI" with:
 *      - Base URL: https://instacart.atlassian.net
 *      - Auth: Basic (email + API token)
 *   2. Create a Supabase data source named "SupabaseDB"
 *   3. Create a Workflow: "refresh_pod_metrics"
 *   4. Add a JavaScript step with this code
 *   5. Schedule to run every Monday at 6 AM Pacific
 */

// ── Configuration ──────────────────────────────────────────────────────────

const JIRA_BASE_URL = 'https://instacart.atlassian.net';
const JIRA_AUTH = Buffer.from(
  `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`
).toString('base64');

// Number of days back to count as "this week"
const WEEK_DAYS = 7;

// Pod → Jira component name patterns (JQL uses "component in (...)")
// Components verified against PSO project on 2026-03-21
const POD_COMPONENTS = {
  ads: [
    'Ads',
    'Carrot Ads - API', 'Carrot Ads - Access Request', 'Carrot Ads - Accounts',
    'Carrot Ads - Ad Serving APIs', 'Carrot Ads - Ad Spending', 'Carrot Ads - Catalog',
    'Carrot Ads - Collections', 'Carrot Ads - Data Engineering', 'Carrot Ads - Metrics',
    'Carrot Ads - Other', 'Carrot Ads - UI',
    'Instacart Ads - Ads Manager API', 'Instacart Ads - Ads Manager UI',
  ],
  cat: [
    'Catalog - Automated Emails', 'Catalog - Availability issue',
    'Catalog - Category / department issue', 'Catalog - Duplicated items',
    'Catalog - External', 'Catalog - Internal', 'Catalog - Move to In-house',
    'Catalog - Private label', 'Catalog - Product creation', 'Catalog - Product scanning',
    'Catalog - Tags', 'Catalog TAM', 'Catalog Vending',
  ],
  caper: [
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
    'Caper UPOS', 'Caper ZBC/Network/Location (Locations Pillar)', 'Caper Zero Orders',
  ],
  faas: [
    'FaaS - Bypass', 'FaaS - Catalog Issues', 'FaaS - Connect Callbacks ',
    'FaaS - Connect Endpoint', 'FaaS - Customer Account', 'FaaS - IPP',
    'FaaS - LMD', 'FaaS - Order Questions', 'FaaS - Others',
    'FaaS - Retailer Error', 'FaaS - Retailer Testing', 'FaaS - Store Setup',
  ],
  fs: [
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
    'Foodstorm - Hybrid Sync', 'Foodstorm - Items API',
  ],
  wl: [
    // TODO: Confirm correct components with WL pod lead
    'OMS Callback Errors', 'OMS Catalog', 'OMS Orders', 'OMS Reports', 'OMS ServiceOptions',
  ],
};

// ── Jira API helpers ────────────────────────────────────────────────────────

/**
 * Fetches all issues matching a JQL query (handles cursor pagination).
 * Returns array of issue objects with .fields populated.
 */
async function searchJira(jql, fields = ['summary', 'created', 'resolutiondate', 'priority', 'status']) {
  const allIssues = [];
  let pageToken = null;

  do {
    const body = {
      jql,
      maxResults: 200,
      fields,
    };
    if (pageToken) body.nextPageToken = pageToken;

    const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/search/jql`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${JIRA_AUTH}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Jira API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    allIssues.push(...(data.issues || []));
    pageToken = data.isLast ? null : data.nextPageToken;
  } while (pageToken);

  return allIssues;
}

/**
 * Fetches SLA data for a single issue via the JSM Service Desk API.
 * Returns { totalCycles, breachedCycles, avgElapsedMs }
 */
async function getIssueSLA(issueIdOrKey) {
  const response = await fetch(
    `${JIRA_BASE_URL}/rest/servicedeskapi/request/${issueIdOrKey}/sla`,
    {
      headers: {
        'Authorization': `Basic ${JIRA_AUTH}`,
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) return null;

  const data = await response.json();
  let totalCycles = 0;
  let breachedCycles = 0;
  let totalElapsedMs = 0;

  for (const sla of (data.values || [])) {
    for (const cycle of (sla.completedCycles || [])) {
      totalCycles++;
      if (cycle.breached) breachedCycles++;
      totalElapsedMs += (cycle.elapsedTime?.millis || 0);
    }
  }

  return { totalCycles, breachedCycles, avgElapsedMs: totalCycles > 0 ? totalElapsedMs / totalCycles : 0 };
}

// ── Main metric computation ─────────────────────────────────────────────────

/**
 * Computes all 6 dashboard metrics for a single pod over the past WEEK_DAYS days.
 * Returns { incoming, throughput, aht_hours, response_sla_pct, resolution_sla_pct,
 *           total_breaches, total_escalations }
 */
async function computePodMetrics(podId, weekStart) {
  const components = POD_COMPONENTS[podId];
  if (!components || components.length === 0) {
    console.warn(`No Jira components configured for pod: ${podId}`);
    return null;
  }

  // JQL: quote each component name; some have special chars like "/" and "("
  const componentList = components.map(c => `"${c}"`).join(', ');
  const dateStr = weekStart.toISOString().split('T')[0]; // YYYY-MM-DD

  // ── 1. Incoming: tickets created this week ──
  const incomingIssues = await searchJira(
    `project = PSO AND component in (${componentList}) AND created >= "${dateStr}"`,
    ['summary', 'created', 'priority']
  );

  // ── 2. Throughput: tickets resolved this week ──
  const resolvedIssues = await searchJira(
    `project = PSO AND component in (${componentList}) AND resolved >= "${dateStr}"`,
    ['summary', 'created', 'resolutiondate', 'priority']
  );

  // ── 3. AHT: average hours from created → resolved (for resolved tickets) ──
  let totalHandleMs = 0;
  for (const issue of resolvedIssues) {
    const created = new Date(issue.fields.created).getTime();
    const resolved = new Date(issue.fields.resolutiondate).getTime();
    if (resolved > created) totalHandleMs += (resolved - created);
  }
  const ahtMs = resolvedIssues.length > 0 ? totalHandleMs / resolvedIssues.length : 0;
  const ahtHours = Math.round((ahtMs / 3_600_000) * 100) / 100; // 2 decimal places

  // ── 4. Escalations: P0 + P1 tickets created this week ──
  const escalations = incomingIssues.filter(
    i => ['P0', 'P1'].includes(i.fields?.priority?.name)
  ).length;

  // ── 5. SLA breaches: query resolved tickets with SLA data ──
  // Note: SLA data requires per-ticket JSM API calls — batch fetch up to 50 resolved tickets
  // For large pod volumes, sample the first 50 tickets for SLA calculation
  let totalSLACycles = 0;
  let breachedCycles = 0;

  const sampleSize = Math.min(resolvedIssues.length, 50);
  for (let i = 0; i < sampleSize; i++) {
    const slaData = await getIssueSLA(resolvedIssues[i].key);
    if (slaData) {
      totalSLACycles += slaData.totalCycles;
      breachedCycles += slaData.breachedCycles;
    }
    // Rate limit: 1 request per 100ms to avoid hitting Jira rate limits
    await new Promise(r => setTimeout(r, 100));
  }

  const slaPct = totalSLACycles > 0
    ? Math.round(((totalSLACycles - breachedCycles) / totalSLACycles) * 10000) / 100
    : 100.0;

  return {
    pod_id: podId,
    week_start: dateStr,
    incoming: incomingIssues.length,
    throughput: resolvedIssues.length,
    aht_hours: ahtHours,
    response_sla_pct: slaPct,   // Using overall SLA% for both (refine if separate SLAs needed)
    resolution_sla_pct: slaPct,
    total_breaches: breachedCycles,
    total_escalations: escalations,
    last_refreshed: new Date().toISOString(),
  };
}

// ── Entry point ─────────────────────────────────────────────────────────────

/**
 * Main workflow function — called by Superblocks scheduler.
 * Refreshes metrics for ALL pods for the current week.
 */
async function refreshAllPodMetrics() {
  const now = new Date();
  // Calculate start of current week (Monday)
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysToMonday);
  weekStart.setHours(0, 0, 0, 0);

  const podIds = Object.keys(POD_COMPONENTS);
  const results = [];

  for (const podId of podIds) {
    console.log(`Fetching metrics for pod: ${podId}...`);
    try {
      const metrics = await computePodMetrics(podId, weekStart);
      if (metrics) results.push(metrics);
    } catch (err) {
      console.error(`Failed to fetch metrics for ${podId}:`, err.message);
    }
  }

  console.log(`Computed metrics for ${results.length}/${podIds.length} pods`);
  return results; // Superblocks passes this to the next step (Supabase upsert)
}

// Run the workflow
return refreshAllPodMetrics();

/*
 * SUPERBLOCKS WORKFLOW STEPS:
 *
 * Step 1 (JavaScript): This file — returns array of metrics objects
 *
 * Step 2 (Supabase): Upsert the results
 *   Table: pod_metrics
 *   Mode: Upsert
 *   Data: {{ step1.output }}
 *   Conflict columns: [pod_id, week_start]
 *   Update columns: [incoming, throughput, aht_hours, response_sla_pct,
 *                    resolution_sla_pct, total_breaches, total_escalations, last_refreshed]
 *
 * Schedule: Every Monday at 6:00 AM Pacific (cron: 0 14 * * 1)
 */
