import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { InvalidCsvError, parseCsvRecords } from './csv.js';

// Database file path
const DB_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
const DB_PATH = process.env.INCIDENTIQ_DB_PATH
  ? path.resolve(process.env.INCIDENTIQ_DB_PATH)
  : path.join(DB_DIR, 'incidentiq.sqlite');
const ACTIVE_DB_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(ACTIVE_DB_DIR)) {
  fs.mkdirSync(ACTIVE_DB_DIR, { recursive: true });
}

export const db = new DatabaseSync(DB_PATH);

// Initialize schema
export function initDatabase() {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('analyst', 'manager', 'reporter')),
      email TEXT NOT NULL,
      avatar TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      affected_system TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('Critical', 'High', 'Medium', 'Low')),
      category TEXT NOT NULL,
      reporter_id TEXT NOT NULL,
      reporter_name TEXT NOT NULL,
      assigned_analyst_id TEXT,
      assigned_analyst_name TEXT,
      status TEXT NOT NULL CHECK(status IN ('Open', 'In Progress', 'Resolved', 'Unresolved', 'Escalation Requested', 'Escalated', 'Reopened')),
      is_demo_data INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      resolution_summary TEXT,
      resolution_evidence TEXT,
      resolution_procedure_id TEXT,
      resolution_verified TEXT DEFAULT 'None' CHECK(resolution_verified IN ('Verified', 'Unverified', 'Incomplete', 'None')),
      resolution_time_minutes INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS assignment_history (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL,
      previous_owner_id TEXT,
      previous_owner_name TEXT,
      new_owner_id TEXT,
      new_owner_name TEXT,
      changed_by_id TEXT NOT NULL,
      changed_by_name TEXT NOT NULL,
      reason TEXT,
      changed_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_assignment_history_incident
      ON assignment_history(incident_id, changed_at);

    CREATE TABLE IF NOT EXISTS investigation_actions (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL,
      analyst_id TEXT NOT NULL,
      analyst_name TEXT NOT NULL,
      description TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now')),
      result TEXT NOT NULL CHECK(result IN ('In Progress', 'Successful', 'Failed', 'Inconclusive')),
      notes TEXT,
      evidence_refs TEXT, -- JSON string array
      follow_up_action TEXT,
      failure_reason TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS log_entries (
      line_id INTEGER PRIMARY KEY,
      month TEXT,
      date TEXT,
      time TEXT,
      level TEXT,
      component TEXT,
      pid TEXT,
      content TEXT,
      event_id TEXT,
      event_template TEXT,
      dataset_name TEXT DEFAULT 'Linux_2k.log_structured.csv',
      imported_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_log_component ON log_entries(component);
    CREATE INDEX IF NOT EXISTS idx_log_event_id ON log_entries(event_id);

    CREATE TABLE IF NOT EXISTS incident_log_links (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL,
      log_line_id INTEGER NOT NULL,
      reason TEXT,
      added_by TEXT NOT NULL,
      added_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
      FOREIGN KEY (log_line_id) REFERENCES log_entries(line_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS escalation_requests (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL,
      requested_by_id TEXT NOT NULL,
      requested_by_name TEXT NOT NULL,
      reason TEXT NOT NULL,
      supporting_details TEXT,
      status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Rejected', 'Returned')),
      reviewed_by_id TEXT,
      reviewed_by_name TEXT,
      review_notes TEXT,
      target_analyst_id TEXT,
      requested_at TEXT DEFAULT (datetime('now')),
      reviewed_at TEXT,
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_role TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      incident_id TEXT,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL,
      content TEXT NOT NULL,
      is_confidential INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      incident_id TEXT,
      details TEXT,
      timestamp TEXT DEFAULT (datetime('now')),
      is_seeded_demo_data INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS dataset_imports (
      id TEXT PRIMARY KEY,
      dataset_name TEXT NOT NULL,
      source TEXT NOT NULL,
      import_time TEXT DEFAULT (datetime('now')),
      total_rows INTEGER DEFAULT 0,
      imported_rows INTEGER DEFAULT 0,
      skipped_rows INTEGER DEFAULT 0,
      errors TEXT,
      status TEXT DEFAULT 'Completed'
    );

    CREATE TABLE IF NOT EXISTS resolution_knowledge (
      id TEXT PRIMARY KEY,
      pattern_name TEXT NOT NULL,
      symptoms TEXT NOT NULL,
      component TEXT NOT NULL,
      verified_procedure TEXT NOT NULL,
      failed_actions_summary TEXT,
      outcome_type TEXT DEFAULT 'Verified',
      evidence_count INTEGER DEFAULT 0,
      times_reused INTEGER DEFAULT 0,
      author_analyst TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      is_demo_data INTEGER NOT NULL DEFAULT 0
    );
  `);

  const auditColumns = db.prepare('PRAGMA table_info(audit_events)').all() as Array<{ name: string }>;
  if (!auditColumns.some(column => column.name === 'is_seeded_demo_data')) {
    db.exec('ALTER TABLE audit_events ADD COLUMN is_seeded_demo_data INTEGER NOT NULL DEFAULT 0');
  }
  db.prepare(`
    UPDATE audit_events SET is_seeded_demo_data = 1
    WHERE id IN ('AUD-01', 'AUD-02', 'AUD-03', 'AUD-04', 'AUD-05')
  `).run();

  const knowledgeColumns = db.prepare('PRAGMA table_info(resolution_knowledge)').all() as Array<{ name: string }>;
  if (!knowledgeColumns.some(column => column.name === 'is_demo_data')) {
    db.exec('ALTER TABLE resolution_knowledge ADD COLUMN is_demo_data INTEGER NOT NULL DEFAULT 0');
  }
  db.prepare(`
    UPDATE resolution_knowledge SET is_demo_data = 1
    WHERE id IN ('KB-MEM-001', 'KB-MEM-002', 'KB-MEM-003')
  `).run();

  const incidentColumns = db.prepare('PRAGMA table_info(incidents)').all() as Array<{ name: string }>;
  if (!incidentColumns.some(column => column.name === 'resolved_at')) {
    db.exec('ALTER TABLE incidents ADD COLUMN resolved_at TEXT');
  }

  seedDemoUsers();
  seedInitialDataIfEmpty();
}

// Seed Demo Users for the 3 distinct roles
function seedDemoUsers() {
  const users = [
    {
      id: 'USR-SEC-01',
      username: 'analyst.elena',
      name: 'Elena Rostova',
      role: 'analyst',
      email: 'e.rostova@zenvora.ibmz.internal',
      avatar: 'ER'
    },
    {
      id: 'USR-SEC-02',
      username: 'analyst.marcus',
      name: 'Marcus Chen',
      role: 'analyst',
      email: 'm.chen@zenvora.ibmz.internal',
      avatar: 'MC'
    },
    {
      id: 'USR-MGR-01',
      username: 'manager.sarah',
      name: 'Sarah Vance',
      role: 'manager',
      email: 's.vance@zenvora.ibmz.internal',
      avatar: 'SV'
    },
    {
      id: 'USR-REP-01',
      username: 'reporter.alex',
      name: 'Alex Rivera',
      role: 'reporter',
      email: 'a.rivera@zenvora.ibmz.internal',
      avatar: 'AR'
    }
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO users (id, username, name, role, email, avatar)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const u of users) {
    stmt.run(u.id, u.username, u.name, u.role, u.email, u.avatar);
  }
}

// Seed realistic demo incidents and import dataset if table is empty
export function seedInitialDataIfEmpty(forceReset = false) {
  if (forceReset) {
    db.exec(`
      DELETE FROM incident_log_links
        WHERE incident_id IN (SELECT id FROM incidents WHERE is_demo_data = 1);
      DELETE FROM investigation_actions
        WHERE incident_id IN (SELECT id FROM incidents WHERE is_demo_data = 1);
      DELETE FROM escalation_requests
        WHERE incident_id IN (SELECT id FROM incidents WHERE is_demo_data = 1);
      DELETE FROM notifications
        WHERE incident_id IN (SELECT id FROM incidents WHERE is_demo_data = 1);
      DELETE FROM comments
        WHERE incident_id IN (SELECT id FROM incidents WHERE is_demo_data = 1);
      DELETE FROM audit_events WHERE is_seeded_demo_data = 1;
      DELETE FROM incidents WHERE is_demo_data = 1;
      DELETE FROM resolution_knowledge WHERE is_demo_data = 1;
    `);
  }

  const incidentCount = db.prepare('SELECT COUNT(*) as cnt FROM incidents').get() as { cnt: number };
  if (incidentCount.cnt > 0 && !forceReset) {
    return;
  }

  // Pre-load knowledge base items
  const kbInsert = db.prepare(`
    INSERT OR REPLACE INTO resolution_knowledge 
    (id, pattern_name, symptoms, component, verified_procedure, failed_actions_summary, outcome_type, evidence_count, times_reused, author_analyst, created_at, is_demo_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-5 days'), 1)
  `);

  kbInsert.run(
    'KB-MEM-001',
    'Repeated SSH Brute-Force and PAM Authentication Failures',
    'Multiple authentication failures on port 22 with user unknown or root target from external hosts',
    'sshd(pam_unix)',
    '1. Inspect source IP burst pattern in sshd logs.\n2. Confirm pam_unix check pass failure is not an internal batch service credential desync.\n3. Implement immediate iptables/nftables rate limiting or fail2ban jail.\n4. Verify SSH public-key only enforcement on affected partition.\n5. Confirm no successful session opening occurred for UID 0.',
    'Attempting service restart without firewall drop allowed attacking IP to maintain connection pool. Simply rotating root password did not halt denial-of-service pressure.',
    'Verified',
    14,
    6,
    'Elena Rostova'
  );

  kbInsert.run(
    'KB-MEM-002',
    'Logrotate Periodic Abrupt Termination [Exit Code 1]',
    'Nightly logrotate cron job fails with "ALERT exited abnormally with [1]" following cyrus/news user pam sessions',
    'logrotate',
    '1. Inspect /var/lib/logrotate.status for permission or lock contention.\n2. Verify SELinux context on target log files in /var/log/cups or mail logs.\n3. Validate logrotate.d service configs for missing prerotate/postrotate exit code handling.\n4. Ensure disk space on logging partition has not breached 95% threshold.\n5. Test manual rotation with logrotate -d -f /etc/logrotate.conf.',
    'Deleting log files directly broke active daemon file descriptors (syslogd/cupsd) and required subsequent emergency service restarts.',
    'Verified',
    8,
    4,
    'Marcus Chen'
  );

  kbInsert.run(
    'KB-MEM-003',
    'Kerberos Replay Cache Lock Contention & Aborted Connections',
    'Authentication failed: Permission denied in replay cache code accompanied by software caused connection abort in klogind',
    'klogind',
    '1. Check ownership and SELinux label of /var/tmp/rc_klogind_* replay cache files.\n2. Clear stale replay cache sockets if owner process has terminated unexpectedly.\n3. Synchronize NTP clocks across KDC and LinuxONE z/VM guest partitions (drift > 300s causes replay rejection).\n4. Increase max concurrent socket listeners in xinetd/klogind config.\n5. Validate Kerberos ticket lifetime against realm policies.',
    'Restarting klogind while old replay cache lock remained caused subsequent auth storms for all cluster nodes.',
    'Verified',
    12,
    3,
    'Elena Rostova'
  );

  // Pre-seed realistic demo incidents
  const incInsert = db.prepare(`
    INSERT INTO incidents 
    (id, title, description, affected_system, severity, category, reporter_id, reporter_name, assigned_analyst_id, assigned_analyst_name, status, is_demo_data, created_at, updated_at, resolution_summary, resolution_evidence, resolution_procedure_id, resolution_verified, resolution_time_minutes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Incident 1: Historical Resolved SSH Attack
  incInsert.run(
    'INC-Z-1042',
    'Surge in SSH Authentication Failures on LinuxONE Web Gateway',
    'High volume of sshd authentication failures and user unknown events detected from external subnets targeting root account.',
    'z/VM Linux Guest 01 (LPAR-PROD-WEB)',
    'High',
    'Security / Authentication',
    'USR-REP-01',
    'Alex Rivera',
    'USR-SEC-01',
    'Elena Rostova',
    'Resolved',
    '2026-10-12 08:30:00',
    '2026-10-12 11:15:00',
    'Applied edge rate-limiting and blocked external IP range. Confirmed zero compromised sessions and validated pam_unix rules.',
    'Verified against 28 log entries in Linux_2k dataset (Lines 4-13, 200-221). No unauthorized session opened.',
    'KB-MEM-001',
    'Verified',
    165
  );

  // Incident 2: Logrotate failure (Escalated & Reviewed)
  incInsert.run(
    'INC-Z-1088',
    'Nightly Logrotate Failure with Alert Exit Code 1',
    'Cron reporting logrotate ALERT exited abnormally with [1] consecutively over multiple daily runs after cyrus PAM session close.',
    'IBM Z Enterprise Syslog Partition (LPAR-OPS-LOGS)',
    'Medium',
    'System Daemon / Storage',
    'USR-REP-01',
    'Alex Rivera',
    'USR-SEC-02',
    'Marcus Chen',
    'In Progress',
    '2026-10-15 04:15:00',
    '2026-10-16 09:20:00',
    null,
    null,
    null,
    'None',
    0
  );

  // Incident 3: Critical Kerberos Replay Cache & Connection Abort
  incInsert.run(
    'INC-Z-1105',
    'Kerberos Replay Cache Permission Denied & Connection Abort Storm',
    'Critical failure in klogind authentication from 163.27.187.39: Replay cache code permission denied and repeated Software caused connection abort.',
    'IBM Z Core Transaction Gateway (LPAR-FIN-CORE)',
    'Critical',
    'Authentication / Kerberos',
    'USR-REP-01',
    'Alex Rivera',
    'USR-SEC-01',
    'Elena Rostova',
    'Escalation Requested',
    '2026-10-16 20:55:00',
    '2026-10-16 21:40:00',
    null,
    null,
    null,
    'None',
    0
  );

  // Incident 4: FTP flood connections
  incInsert.run(
    'INC-Z-1110',
    'Anomalous Concurrent FTP Inbound Sockets Detected',
    'Rapid bursts of concurrent ftpd connections from external IPs (202.82.200.188 and 82.68.222.194) with intermittent anonymous attempts.',
    'LinuxONE File Transfer Gateway (LPAR-EXT-FTP)',
    'Medium',
    'Network / Perimeter',
    'USR-REP-01',
    'Alex Rivera',
    'USR-SEC-02',
    'Marcus Chen',
    'Open',
    '2026-10-16 22:00:00',
    '2026-10-16 22:00:00',
    null,
    null,
    null,
    'None',
    0
  );

  // Investigation Actions for INC-Z-1042
  const actInsert = db.prepare(`
    INSERT INTO investigation_actions 
    (id, incident_id, analyst_id, analyst_name, description, timestamp, result, notes, evidence_refs, follow_up_action, failure_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  actInsert.run(
    'ACT-1042-01',
    'INC-Z-1042',
    'USR-SEC-01',
    'Elena Rostova',
    'Analyzed sshd log stream for targeted usernames and source IP distribution',
    '2026-10-12 09:00:00',
    'Successful',
    'Found 12 repetitive attempts specifically guessing user=root from 220-135-151-1.hinet-ip.hinet.net and 218.188.2.4.',
    JSON.stringify([4, 5, 6, 7, 8, 9, 10]),
    'Check if passwords were accepted on any session',
    null
  );

  actInsert.run(
    'ACT-1042-02',
    'INC-Z-1042',
    'USR-SEC-01',
    'Elena Rostova',
    'Attempted immediate daemon reload without perimeter IP drop',
    '2026-10-12 09:40:00',
    'Failed',
    'Daemon restart did not drop existing TCP handshake queue; attacking host immediately flooded port 22 again.',
    JSON.stringify([11, 12, 13]),
    'Deploy perimeter firewall drop rule at edge gateway',
    'Process-level daemon restart cannot mitigate network-level connection saturation.'
  );

  actInsert.run(
    'ACT-1042-03',
    'INC-Z-1042',
    'USR-SEC-01',
    'Elena Rostova',
    'Configured iptables drop rule for offending subnet and enforced PermitRootLogin no',
    '2026-10-12 10:45:00',
    'Successful',
    'Attacking connections ceased immediately. Verified all pam_unix session audits were clean.',
    JSON.stringify([20, 22, 24]),
    'Document procedure in Incident Memory KB',
    null
  );

  // Investigation Actions for INC-Z-1105
  actInsert.run(
    'ACT-1105-01',
    'INC-Z-1105',
    'USR-SEC-01',
    'Elena Rostova',
    'Triaged klogind error events and checked /var/tmp replay cache permission bits',
    '2026-10-16 21:10:00',
    'In Progress',
    'Replay cache locked with stale descriptor after parent worker termination. Over 40 connection aborts recorded in under 2 minutes.',
    JSON.stringify([539, 541, 543, 545, 553, 557]),
    'Request Manager Escalation for cross-partition Kerberos cache flush',
    null
  );

  // Escalation request for INC-Z-1105
  const escInsert = db.prepare(`
    INSERT INTO escalation_requests 
    (id, incident_id, requested_by_id, requested_by_name, reason, supporting_details, status, requested_at)
    VALUES (?, ?, ?, ?, ?, ?, 'Pending', '2026-10-16 21:30:00')
  `);
  escInsert.run(
    'ESC-REQ-1105',
    'INC-Z-1105',
    'USR-SEC-01',
    'Elena Rostova',
    'Critical transaction partition impacted by Kerberos replay cache lock. Requires z/OS Sysplex coordination.',
    'Over 40 klogind aborts logged (Lines 539-584). Local analyst lacks authorization to reset cross-LPAR Kerberos tokens without manager sign-off.'
  );

  // Initial Notifications
  const notifInsert = db.prepare(`
    INSERT INTO notifications (id, user_id, user_role, title, message, type, incident_id, read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  notifInsert.run(
    'NOTIF-01',
    'USR-MGR-01',
    'manager',
    'Escalation Review Required: INC-Z-1105',
    'Analyst Elena Rostova requested escalation for Critical Incident INC-Z-1105 (Kerberos Replay Cache Storm).',
    'escalation_requested',
    'INC-Z-1105',
    0,
    '2026-10-16 21:30:05'
  );

  notifInsert.run(
    'NOTIF-02',
    'USR-SEC-01',
    'analyst',
    'Critical Incident Assigned: INC-Z-1105',
    'You have been assigned to Critical Incident INC-Z-1105 on LPAR-FIN-CORE.',
    'incident_assigned',
    'INC-Z-1105',
    0,
    '2026-10-16 20:56:00'
  );

  notifInsert.run(
    'NOTIF-03',
    'USR-REP-01',
    'reporter',
    'Incident Status Update: INC-Z-1042 Resolved',
    'Your submitted incident INC-Z-1042 has been verified and successfully resolved.',
    'incident_resolved',
    'INC-Z-1042',
    1,
    '2026-10-12 11:15:30'
  );

  // Audit Events
  const auditInsert = db.prepare(`
    INSERT INTO audit_events (id, actor_id, actor_name, actor_role, action, incident_id, details, timestamp, is_seeded_demo_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  auditInsert.run(
    'AUD-01',
    'USR-REP-01',
    'Alex Rivera',
    'reporter',
    'INCIDENT_CREATED',
    'INC-Z-1042',
    'Created incident "Surge in SSH Authentication Failures on LinuxONE Web Gateway" with High severity',
    '2026-10-12 08:30:00'
  );

  auditInsert.run(
    'AUD-02',
    'USR-SEC-01',
    'Elena Rostova',
    'analyst',
    'INVESTIGATION_ACTION_RECORDED',
    'INC-Z-1042',
    'Recorded action ACT-1042-01: Analyzed sshd log stream for targeted usernames and source IP',
    '2026-10-12 09:00:00'
  );

  auditInsert.run(
    'AUD-03',
    'USR-SEC-01',
    'Elena Rostova',
    'analyst',
    'FAILED_ATTEMPT_RECORDED',
    'INC-Z-1042',
    'Recorded failed action ACT-1042-02: Daemon reload failed to drop network TCP connections',
    '2026-10-12 09:40:00'
  );

  auditInsert.run(
    'AUD-04',
    'USR-SEC-01',
    'Elena Rostova',
    'analyst',
    'INCIDENT_RESOLVED',
    'INC-Z-1042',
    'Marked incident as Resolved with verified procedure KB-MEM-001',
    '2026-10-12 11:15:00'
  );

  auditInsert.run(
    'AUD-05',
    'USR-SEC-01',
    'Elena Rostova',
    'analyst',
    'ESCALATION_REQUESTED',
    'INC-Z-1105',
    'Submitted escalation request ESC-REQ-1105 for Manager review',
    '2026-10-16 21:30:00'
  );

  // Ingest logs from CSV if log_entries is empty
  ingestLogFileIfEmpty();
}

export function ingestLogFileIfEmpty() {
  const logCount = db.prepare('SELECT COUNT(*) as cnt FROM log_entries').get() as { cnt: number };
  if (logCount.cnt > 0) return;

  const csvPath = path.resolve(process.cwd(), 'data', 'Linux_2k.log_structured.csv');
  if (!fs.existsSync(csvPath)) return;

  const raw = fs.readFileSync(csvPath, 'utf-8');
  importLogCsv(raw, 'Linux_2k.log_structured.csv', true);
}

export function importLogCsv(raw: string, datasetName: string, isBundledLogHubDataset = false) {
  const records = parseCsvRecords(raw);
  if (records.length < 2) {
    throw new InvalidCsvError('Malformed or empty CSV file. Expected a header and data rows.');
  }

  const headerRecord = records[0];
  if (headerRecord.error) throw new InvalidCsvError(`Malformed CSV header on line ${headerRecord.lineNumber}.`);

  const columns = new Map(headerRecord.fields.map((name, index) => [name.trim().toLowerCase(), index]));
  const lineIdColumn = columns.get('lineid');
  const contentColumn = columns.get('content');
  if (lineIdColumn === undefined || contentColumn === undefined) {
    throw new InvalidCsvError('Invalid CSV schema. Required columns: LineId and Content.');
  }

  const getValue = (row: string[], name: string) => {
    const column = columns.get(name.toLowerCase());
    return column === undefined ? '' : (row[column] || '');
  };
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO log_entries
    (line_id, month, date, time, level, component, pid, content, event_id, event_template, dataset_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const dataRecords = records.slice(1);

  for (const record of dataRecords) {
    const { fields } = record;
    const lineIdValue = fields[lineIdColumn]?.trim() || '';
    if (record.error || !/^\d+$/.test(lineIdValue) || !fields[contentColumn]) {
      skipped++;
      errors.push(`Line ${record.lineNumber}: ${record.error || 'missing or invalid LineId/Content'}`);
      continue;
    }

    const lineId = Number(lineIdValue);
    if (!Number.isSafeInteger(lineId)) {
      skipped++;
      errors.push(`Line ${record.lineNumber}: LineId is outside the safe integer range`);
      continue;
    }

    const result = insertStmt.run(
      lineId,
      getValue(fields, 'month'),
      getValue(fields, 'date'),
      getValue(fields, 'time'),
      getValue(fields, 'level'),
      getValue(fields, 'component'),
      getValue(fields, 'pid'),
      fields[contentColumn],
      getValue(fields, 'eventid'),
      getValue(fields, 'eventtemplate'),
      datasetName
    );

    if (Number(result.changes) === 1) {
      imported++;
    } else {
      skipped++;
      errors.push(`Line ${record.lineNumber}: duplicate LineId ${lineId}`);
    }
  }

  const source = isBundledLogHubDataset && datasetName === 'Linux_2k.log_structured.csv'
    ? 'LogHub Linux structured dataset — demonstration and investigation only; not verified IBM Z production logs'
    : `CSV upload: ${datasetName}`;
  const importId = `IMP-${Date.now()}-${randomUUID()}`;
  db.prepare(`
    INSERT INTO dataset_imports
    (id, dataset_name, source, import_time, total_rows, imported_rows, skipped_rows, errors, status)
    VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?, ?)
  `).run(
    importId,
    datasetName,
    source,
    dataRecords.length,
    imported,
    skipped,
    JSON.stringify(errors.slice(0, 100)),
    skipped === 0 ? 'Completed' : 'Completed with skipped rows'
  );

  if (isBundledLogHubDataset && datasetName === 'Linux_2k.log_structured.csv') {
    const seedLinks = [
      ['LNK-01', 'INC-Z-1042', 4, 'Targeted root brute force attempt', 'Elena Rostova'],
      ['LNK-02', 'INC-Z-1042', 5, 'Consecutive failure within same second', 'Elena Rostova'],
      ['LNK-03', 'INC-Z-1042', 20, 'Follow-up failure from 218.188.2.4', 'Elena Rostova'],
      ['LNK-04', 'INC-Z-1088', 16, 'Nightly alert exited abnormally with 1', 'Marcus Chen'],
      ['LNK-05', 'INC-Z-1088', 75, 'Repeated exit alert 24h later', 'Marcus Chen'],
      ['LNK-06', 'INC-Z-1105', 539, 'Replay cache code permission denied', 'Elena Rostova'],
      ['LNK-07', 'INC-Z-1105', 540, 'Kerberos authentication failed in klogind', 'Elena Rostova'],
      ['LNK-08', 'INC-Z-1105', 553, 'Software caused connection abort in replay loop', 'Elena Rostova']
    ];
    const link = db.prepare(`
      INSERT OR IGNORE INTO incident_log_links (id, incident_id, log_line_id, reason, added_by)
      SELECT ?, ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM incidents WHERE id = ? AND is_demo_data = 1)
        AND EXISTS (SELECT 1 FROM log_entries WHERE line_id = ?)
    `);
    for (const [id, incidentId, lineId, reason, addedBy] of seedLinks) {
      link.run(id, incidentId, lineId, reason, addedBy, incidentId, lineId);
    }
  }

  return {
    importId,
    totalProcessed: dataRecords.length,
    imported,
    skipped,
    datasetName,
    errors: errors.slice(0, 100)
  };
}
