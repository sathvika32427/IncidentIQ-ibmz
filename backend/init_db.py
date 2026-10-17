#!/usr/bin/env python3
"""
IncidentIQ - Python Database Initializer for IBM LinuxONE (s390x)
Initializes SQLite schema and imports LogHub Linux 2k benchmark dataset.
"""

import sqlite3
import os
import csv
import json

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, "incidentiq.sqlite")

def init_db():
    print(f"[IncidentIQ] Initializing SQLite database at: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.executescript("""
    PRAGMA foreign_keys = ON;

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
      resolution_time_minutes INTEGER DEFAULT 0,
      resolved_at TEXT
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
      evidence_refs TEXT,
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
      timestamp TEXT DEFAULT (datetime('now'))
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
      updated_at TEXT DEFAULT (datetime('now'))
    );
    """)

    incident_columns = {row[1] for row in cursor.execute("PRAGMA table_info(incidents)")}
    if "resolved_at" not in incident_columns:
        cursor.execute("ALTER TABLE incidents ADD COLUMN resolved_at TEXT")

    # Seed users
    users = [
        ('USR-SEC-01', 'analyst.elena', 'Elena Rostova', 'analyst', 'e.rostova@zenvora.ibmz.internal', 'ER'),
        ('USR-SEC-02', 'analyst.marcus', 'Marcus Chen', 'analyst', 'm.chen@zenvora.ibmz.internal', 'MC'),
        ('USR-MGR-01', 'manager.sarah', 'Sarah Vance', 'manager', 's.vance@zenvora.ibmz.internal', 'SV'),
        ('USR-REP-01', 'reporter.alex', 'Alex Rivera', 'reporter', 'a.rivera@zenvora.ibmz.internal', 'AR'),
    ]
    cursor.executemany("INSERT OR IGNORE INTO users VALUES (?, ?, ?, ?, ?, ?, datetime('now'))", users)

    conn.commit()
    conn.close()
    print("[IncidentIQ] Database initialized successfully.")

if __name__ == "__main__":
    init_db()
