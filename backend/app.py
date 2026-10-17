#!/usr/bin/env python3
"""
IncidentIQ - Python Flask REST API
Production-ready backend for deployment on Ubuntu 24.04 (s390x / IBM LinuxONE Community Cloud)
"""

import os
import sqlite3
import json
import math
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
DB_PATH = os.path.join(DB_DIR, "incidentiq.sqlite")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "platform": "IncidentIQ Python Flask (LinuxONE / s390x)",
        "sqlite_db": DB_PATH
    })

@app.route("/api/auth/users", methods=["GET"])
def list_users():
    conn = get_db()
    users = [dict(r) for r in conn.execute("SELECT id, username, name, role, email, avatar FROM users").fetchall()]
    conn.close()
    return jsonify({"users": users, "aiAvailable": bool(os.getenv("GEMINI_API_KEY"))})

@app.route("/api/analytics/overview", methods=["GET"])
def overview():
    conn = get_db()
    totals = dict(conn.execute("""
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) as open_count,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress_count,
        SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as resolved_count,
        SUM(CASE WHEN status = 'Unresolved' THEN 1 ELSE 0 END) as unresolved_count,
        SUM(CASE WHEN status = 'Escalation Requested' OR status = 'Escalated' THEN 1 ELSE 0 END) as escalated_count,
        SUM(CASE WHEN severity = 'Critical' THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN severity = 'High' THEN 1 ELSE 0 END) as high_count,
        SUM(CASE WHEN status = 'Resolved' AND resolution_verified = 'Verified' AND resolution_summary IS NOT NULL THEN 1 ELSE 0 END) as verified_count,
        SUM(CASE WHEN resolution_summary IS NOT NULL THEN 1 ELSE 0 END) as resolution_attempt_count
      FROM incidents
    """).fetchone())

    avg_res = conn.execute("SELECT AVG(resolution_time_minutes) as avg_time FROM incidents WHERE status = 'Resolved' AND resolution_verified = 'Verified' AND resolution_summary IS NOT NULL AND resolution_time_minutes > 0").fetchone()
    actions = conn.execute("""
      SELECT 
        SUM(CASE WHEN result = 'Successful' THEN 1 ELSE 0 END) as successful_actions,
        SUM(CASE WHEN result = 'Failed' THEN 1 ELSE 0 END) as failed_actions,
        SUM(CASE WHEN result = 'In Progress' THEN 1 ELSE 0 END) as in_progress_actions,
        SUM(CASE WHEN result = 'Inconclusive' THEN 1 ELSE 0 END) as inconclusive_actions
      FROM investigation_actions
    """).fetchone()

    pending_esc = conn.execute("SELECT COUNT(*) as cnt FROM escalation_requests WHERE status = 'Pending'").fetchone()
    logs_cnt = conn.execute("SELECT COUNT(*) as cnt FROM log_entries").fetchone()

    sev_dist = [dict(r) for r in conn.execute("SELECT severity, COUNT(*) as count FROM incidents GROUP BY severity").fetchall()]
    status_dist = [dict(r) for r in conn.execute("SELECT status, COUNT(*) as count FROM incidents GROUP BY status").fetchall()]
    system_dist = [dict(r) for r in conn.execute("SELECT affected_system, COUNT(*) as count FROM incidents GROUP BY affected_system ORDER BY count DESC LIMIT 5").fetchall()]
    log_components = [dict(r) for r in conn.execute("SELECT component, COUNT(*) as count FROM log_entries WHERE component != '' GROUP BY component ORDER BY count DESC LIMIT 6").fetchall()]
    analysts = [dict(r) for r in conn.execute("""
      SELECT u.id as analyst_id, u.name as analyst, COUNT(i.id) as total_assigned,
        SUM(CASE WHEN i.status = 'Resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN i.id IS NOT NULL AND i.status != 'Resolved' THEN 1 ELSE 0 END) as active
      FROM users u LEFT JOIN incidents i ON i.assigned_analyst_id = u.id
      WHERE u.role = 'analyst' GROUP BY u.id, u.name ORDER BY u.name
    """).fetchall()]
    action_dist = [dict(r) for r in conn.execute("SELECT result, COUNT(*) as count FROM investigation_actions GROUP BY result").fetchall()]
    escalation_dist = [dict(r) for r in conn.execute("SELECT status, COUNT(*) as count FROM escalation_requests GROUP BY status").fetchall()]
    unassigned_count = conn.execute("SELECT COUNT(*) as cnt FROM incidents WHERE assigned_analyst_id IS NULL").fetchone()["cnt"]
    incident_trends = [dict(r) for r in conn.execute("""
      SELECT day, SUM(opened) as opened, SUM(resolved) as resolved FROM (
        SELECT date(created_at) as day, 1 as opened, 0 as resolved FROM incidents WHERE date(created_at) IS NOT NULL
        UNION ALL
        SELECT date(COALESCE(resolved_at, updated_at)) as day, 0 as opened, 1 as resolved
        FROM incidents WHERE status = 'Resolved' AND date(COALESCE(resolved_at, updated_at)) IS NOT NULL
      ) GROUP BY day ORDER BY day
    """).fetchall()]
    conn.close()

    return jsonify({
        "metrics": {
            "total_incidents": totals.get("total") or 0,
            "open_incidents": totals.get("open_count") or 0,
            "in_progress_incidents": totals.get("in_progress_count") or 0,
            "resolved_incidents": totals.get("resolved_count") or 0,
            "unresolved_incidents": totals.get("unresolved_count") or 0,
            "escalated_incidents": totals.get("escalated_count") or 0,
            "critical_incidents": totals.get("critical_count") or 0,
            "high_incidents": totals.get("high_count") or 0,
            "verified_resolutions": totals.get("verified_count") or 0,
            "active_incidents": max(0, (totals.get("total") or 0) - (totals.get("resolved_count") or 0)),
            "resolution_success_rate": round((totals.get("verified_count") or 0) / totals["resolution_attempt_count"] * 100) if totals.get("resolution_attempt_count") else None,
            "resolution_attempts": totals.get("resolution_attempt_count") or 0,
            "unassigned_incidents": unassigned_count,
            "pending_escalation_reviews": pending_esc["cnt"] if pending_esc else 0,
            "avg_resolution_time_minutes": round(avg_res["avg_time"] or 0) if avg_res else 0,
            "successful_actions": actions["successful_actions"] or 0 if actions else 0,
            "failed_actions": actions["failed_actions"] or 0 if actions else 0,
            "in_progress_actions": actions["in_progress_actions"] or 0 if actions else 0,
            "inconclusive_actions": actions["inconclusive_actions"] or 0 if actions else 0,
            "total_log_evidence": logs_cnt["cnt"] if logs_cnt else 0
        },
        "charts": {
            "severity_distribution": sev_dist,
            "status_distribution": status_dist,
            "system_distribution": system_dist,
            "log_components": log_components,
            "analyst_workload": analysts,
            "action_distribution": action_dist,
            "escalation_distribution": escalation_dist,
            "incident_trends": incident_trends
        }
    })

@app.route("/api/incidents", methods=["GET", "POST"])
def incidents_route():
    conn = get_db()
    if request.method == "POST":
        data = request.json or {}
        inc_id = f"INC-Z-{os.urandom(2).hex().upper()}"
        assigned_id = "USR-SEC-01" if data.get("severity") in ("Critical", "High") else None
        assigned_name = "Elena Rostova" if assigned_id else None
        conn.execute("""
            INSERT INTO incidents 
            (id, title, description, affected_system, severity, category, reporter_id, reporter_name, assigned_analyst_id, assigned_analyst_name, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', datetime('now'), datetime('now'))
        """, (
            inc_id,
            data.get("title", "").strip(),
            data.get("description", "").strip(),
            data.get("affected_system", "z/VM Linux Guest 01"),
            data.get("severity", "Medium"),
            data.get("category", "General Incident"),
            data.get("reporter_id", "USR-REP-01"),
            data.get("reporter_name", "Alex Rivera"),
            assigned_id,
            assigned_name
        ))
        if assigned_id:
            conn.execute("""
              INSERT INTO assignment_history
                (id, incident_id, new_owner_id, new_owner_name, changed_by_id, changed_by_name, reason, changed_at)
              VALUES (?, ?, ?, ?, 'SYSTEM', 'IncidentIQ severity routing', ?, datetime('now'))
            """, (
                f"ASG-{os.urandom(4).hex()}",
                inc_id,
                assigned_id,
                assigned_name,
                f"Automatically assigned because severity is {data.get('severity')}."
            ))
        conn.commit()
        created = dict(conn.execute("SELECT * FROM incidents WHERE id = ?", (inc_id,)).fetchone())
        conn.close()
        return jsonify({"incident": created}), 201

    # GET
    rows = [dict(r) for r in conn.execute("""
      SELECT i.*,
        (SELECT MAX(ah.changed_at) FROM assignment_history ah
         WHERE ah.incident_id = i.id AND ah.new_owner_id = i.assigned_analyst_id) as assignment_timestamp
      FROM incidents i ORDER BY i.created_at DESC
    """).fetchall()]
    conn.close()
    return jsonify({"incidents": rows})

@app.route("/api/logs", methods=["GET"])
def logs_route():
    conn = get_db()
    component = request.args.get("component")
    search = request.args.get("search")
    limit = int(request.args.get("limit", 50))
    offset = int(request.args.get("offset", 0))

    query = "SELECT * FROM log_entries WHERE 1=1"
    params = []
    if component and component != "all":
        query += " AND component = ?"
        params.append(component)
    if search:
        query += " AND (content LIKE ? OR component LIKE ?)"
        s = f"%{search}%"
        params.extend([s, s])

    count = conn.execute(query.replace("SELECT *", "SELECT COUNT(*) as cnt"), params).fetchone()["cnt"]
    query += " ORDER BY line_id ASC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    rows = [dict(r) for r in conn.execute(query, params).fetchall()]
    components = [dict(r) for r in conn.execute("SELECT DISTINCT component, COUNT(*) as count FROM log_entries WHERE component != '' GROUP BY component ORDER BY count DESC").fetchall()]
    event_ids = [dict(r) for r in conn.execute("SELECT DISTINCT event_id, COUNT(*) as count FROM log_entries WHERE event_id != '' GROUP BY event_id ORDER BY count DESC LIMIT 20").fetchall()]
    conn.close()

    return jsonify({
        "logs": rows,
        "total": count,
        "components": components,
        "eventIds": event_ids
    })

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"[IncidentIQ] Starting Python backend on 0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
