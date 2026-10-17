import express from 'express';
import { db, seedInitialDataIfEmpty, importLogCsv } from './db.js';
import { findSimilarIncidents } from './similarity.js';
import { getRecommendations, handleAssistantChat, isAIAvailable, verifyAIAvailability } from './ai.js';
import { InvalidCsvError } from './csv.js';
import fs from 'node:fs';
import path from 'node:path';

export const apiRouter = express.Router();

type DemoActor = {
  id: string;
  name: string;
  role: 'analyst' | 'manager' | 'reporter' | 'system';
};

function getDemoActor(userId: unknown): DemoActor | null {
  if (typeof userId !== 'string' || !userId.trim()) return null;
  return (db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(userId) as DemoActor | undefined) || null;
}

function respondForActor(
  userId: unknown,
  res: express.Response,
  allowedRoles: DemoActor['role'][]
): DemoActor | null {
  const actor = getDemoActor(userId);
  if (!actor) {
    res.status(401).json({ error: 'Select a valid demo account before performing this action.' });
    return null;
  }
  if (!allowedRoles.includes(actor.role)) {
    res.status(403).json({ error: 'Your account role is not permitted to perform this action.' });
    return null;
  }
  return actor;
}

function canWorkIncident(actor: DemoActor, incident: { assigned_analyst_id: string | null }, res: express.Response): boolean {
  if (actor.role === 'manager') return true;
  if (actor.role === 'analyst' && incident.assigned_analyst_id === actor.id) return true;
  res.status(403).json({
    error: incident.assigned_analyst_id
      ? 'This incident is assigned to another analyst.'
      : 'Claim this unassigned incident before investigating it.'
  });
  return false;
}

function recordAssignment(
  incidentId: string,
  previousOwnerId: string | null,
  previousOwnerName: string | null,
  newOwnerId: string | null,
  newOwnerName: string | null,
  actor: DemoActor,
  reason?: string
) {
  db.prepare(`
    INSERT INTO assignment_history
      (id, incident_id, previous_owner_id, previous_owner_name, new_owner_id, new_owner_name, changed_by_id, changed_by_name, reason, changed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    `ASG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    incidentId,
    previousOwnerId,
    previousOwnerName,
    newOwnerId,
    newOwnerName,
    actor.id,
    actor.name,
    reason?.trim() || null
  );
}

// Helper to record audit events
export function recordAudit(actorId: string, actorName: string, actorRole: string, action: string, incidentId: string | null, details: string) {
  try {
    const id = `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    db.prepare(`
      INSERT INTO audit_events (id, actor_id, actor_name, actor_role, action, incident_id, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, actorId, actorName, actorRole, action, incidentId, details);
  } catch (e) {
    console.error('Audit recording error:', e);
  }
}

// Helper to create notifications
export function createNotification(userId: string | null, userRole: string | null, title: string, message: string, type: string, incidentId: string | null) {
  try {
    const id = `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    db.prepare(`
      INSERT INTO notifications (id, user_id, user_role, title, message, type, incident_id, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
    `).run(id, userId, userRole, title, message, type, incidentId);
  } catch (e) {
    console.error('Notification creation error:', e);
  }
}

// -------------------------------------------------------------
// 1. Auth & Demo User Profiles
// -------------------------------------------------------------
apiRouter.get('/auth/users', (req, res) => {
  const users = db.prepare(`
    SELECT id, username, name, role, email, avatar,
      CASE WHEN id IN ('USR-SEC-01', 'USR-SEC-02', 'USR-MGR-01', 'USR-REP-01') THEN 1 ELSE 0 END AS is_demo_user
    FROM users
  `).all();
  res.json({ users, aiAvailable: isAIAvailable() });
});

apiRouter.get('/auth/status', async (req, res) => {
  const aiStatus = await verifyAIAvailability();
  res.json({
    aiAvailable: aiStatus.state === 'available',
    aiModel: aiStatus.state === 'available' ? 'gemini-2.5-flash' : 'rule-based-engine',
    aiStatus,
    environment: 'IncidentIQ Express + SQLite'
  });
});

// -------------------------------------------------------------
// 2. Overview & Analytics
// -------------------------------------------------------------
apiRouter.get('/analytics/overview', (req, res) => {
  try {
    // Real database calculations
    const totals = db.prepare(`
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
    `).get() as any;

    const avgTimeRow = db.prepare(`
      SELECT AVG(resolution_time_minutes) as avg_res_time 
      FROM incidents 
      WHERE status = 'Resolved' AND resolution_verified = 'Verified'
        AND resolution_summary IS NOT NULL AND resolution_time_minutes > 0
    `).get() as any;

    const actionStats = db.prepare(`
      SELECT 
        SUM(CASE WHEN result = 'Successful' THEN 1 ELSE 0 END) as successful_actions,
        SUM(CASE WHEN result = 'Failed' THEN 1 ELSE 0 END) as failed_actions,
        SUM(CASE WHEN result = 'In Progress' THEN 1 ELSE 0 END) as in_progress_actions,
        SUM(CASE WHEN result = 'Inconclusive' THEN 1 ELSE 0 END) as inconclusive_actions
      FROM investigation_actions
    `).get() as any;

    const pendingEscalations = db.prepare(`
      SELECT COUNT(*) as cnt FROM escalation_requests WHERE status = 'Pending'
    `).get() as any;

    // Severity Breakdown
    const severityDist = db.prepare(`
      SELECT severity, COUNT(*) as count FROM incidents GROUP BY severity
    `).all();

    // Status Breakdown
    const statusDist = db.prepare(`
      SELECT status, COUNT(*) as count FROM incidents GROUP BY status
    `).all();

    // System Breakdown
    const systemDist = db.prepare(`
      SELECT affected_system, COUNT(*) as count FROM incidents GROUP BY affected_system ORDER BY count DESC LIMIT 5
    `).all();

    // Log Component Frequency from LogHub Linux dataset
    const logComponents = db.prepare(`
      SELECT component, COUNT(*) as count 
      FROM log_entries 
      WHERE component != '' 
      GROUP BY component 
      ORDER BY count DESC 
      LIMIT 6
    `).all();

    // Analyst Workload
    const analystWorkload = db.prepare(`
      SELECT 
        u.id as analyst_id,
        u.name as analyst,
        COUNT(i.id) as total_assigned,
        SUM(CASE WHEN i.status = 'Resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN i.id IS NOT NULL AND i.status != 'Resolved' THEN 1 ELSE 0 END) as active
      FROM users u
      LEFT JOIN incidents i ON i.assigned_analyst_id = u.id
      WHERE u.role = 'analyst'
      GROUP BY u.id, u.name
      ORDER BY u.name
    `).all();

    const actionDistribution = db.prepare(`
      SELECT result, COUNT(*) as count FROM investigation_actions GROUP BY result
    `).all();

    const escalationDistribution = db.prepare(`
      SELECT status, COUNT(*) as count FROM escalation_requests GROUP BY status
    `).all();

    const unassignedCount = db.prepare(`
      SELECT COUNT(*) as count FROM incidents WHERE assigned_analyst_id IS NULL
    `).get() as any;

    const incidentTrends = db.prepare(`
      SELECT day, SUM(opened) as opened, SUM(resolved) as resolved
      FROM (
        SELECT date(created_at) as day, 1 as opened, 0 as resolved
        FROM incidents
        WHERE date(created_at) IS NOT NULL
        UNION ALL
        SELECT date(COALESCE(resolved_at, updated_at)) as day, 0 as opened, 1 as resolved
        FROM incidents
        WHERE status = 'Resolved' AND date(COALESCE(resolved_at, updated_at)) IS NOT NULL
      )
      GROUP BY day
      ORDER BY day
    `).all();

    // Total log records in dataset
    const logCount = db.prepare('SELECT COUNT(*) as count FROM log_entries').get() as any;

    res.json({
      metrics: {
        total_incidents: totals.total || 0,
        open_incidents: totals.open_count || 0,
        in_progress_incidents: totals.in_progress_count || 0,
        resolved_incidents: totals.resolved_count || 0,
        unresolved_incidents: totals.unresolved_count || 0,
        escalated_incidents: totals.escalated_count || 0,
        critical_incidents: totals.critical_count || 0,
        high_incidents: totals.high_count || 0,
        verified_resolutions: totals.verified_count || 0,
        active_incidents: Math.max(0, (totals.total || 0) - (totals.resolved_count || 0)),
        resolution_success_rate: totals.resolution_attempt_count
          ? Math.round(((totals.verified_count || 0) / totals.resolution_attempt_count) * 100)
          : null,
        resolution_attempts: totals.resolution_attempt_count || 0,
        unassigned_incidents: unassignedCount.count || 0,
        pending_escalation_reviews: pendingEscalations.cnt || 0,
        avg_resolution_time_minutes: Math.round(avgTimeRow.avg_res_time || 0),
        successful_actions: actionStats.successful_actions || 0,
        failed_actions: actionStats.failed_actions || 0,
        total_log_evidence: logCount.count || 0
      },
      charts: {
        severity_distribution: severityDist,
        status_distribution: statusDist,
        system_distribution: systemDist,
        log_components: logComponents,
        analyst_workload: analystWorkload,
        action_distribution: actionDistribution,
        escalation_distribution: escalationDistribution,
        incident_trends: incidentTrends
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 3. Incidents CRUD & Management
// -------------------------------------------------------------
apiRouter.get('/incidents', (req, res) => {
  try {
    const { status, severity, system, analyst, search, reporter_id } = req.query;
    let query = `SELECT i.*,
      (SELECT MAX(ah.changed_at) FROM assignment_history ah
       WHERE ah.incident_id = i.id AND ah.new_owner_id = i.assigned_analyst_id) AS assignment_timestamp
      FROM incidents i WHERE 1=1`;
    const params: any[] = [];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    if (severity && severity !== 'all') {
      query += ' AND severity = ?';
      params.push(severity);
    }
    if (system && system !== 'all') {
      query += ' AND affected_system = ?';
      params.push(system);
    }
    if (analyst && analyst !== 'all') {
      query += ' AND assigned_analyst_id = ?';
      params.push(analyst);
    }
    if (reporter_id) {
      query += ' AND reporter_id = ?';
      params.push(reporter_id);
    }
    if (search) {
      query += ' AND (id LIKE ? OR title LIKE ? OR description LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY created_at DESC';
    const incidents = db.prepare(query).all(...params);
    res.json({ incidents });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/incidents', (req, res) => {
  try {
    const { title, description, affected_system, severity, category, reporter_id, reporter_name } = req.body;

    if (!title || !description || !affected_system || !severity) {
      return res.status(400).json({ error: 'Title, description, affected system, and severity are required.' });
    }

    const nextIdNum = Math.floor(1000 + Math.random() * 9000);
    const incidentId = `INC-Z-${nextIdNum}`;

    // Auto-assign to an analyst for high/critical if possible, or leave unassigned
    let assignedId = null;
    let assignedName = null;
    if (severity === 'Critical' || severity === 'High') {
      assignedId = 'USR-SEC-01';
      assignedName = 'Elena Rostova';
    }

    db.prepare(`
      INSERT INTO incidents (
        id, title, description, affected_system, severity, category,
        reporter_id, reporter_name, assigned_analyst_id, assigned_analyst_name,
        status, is_demo_data, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Open', 0, datetime('now'), datetime('now'))
    `).run(
      incidentId,
      title.trim(),
      description.trim(),
      affected_system,
      severity,
      category || 'General Incident',
      reporter_id || 'USR-REP-01',
      reporter_name || 'Alex Rivera',
      assignedId,
      assignedName
    );

    if (assignedId && assignedName) {
      recordAssignment(
        incidentId,
        null,
        null,
        assignedId,
        assignedName,
        { id: 'SYSTEM', name: 'IncidentIQ severity routing', role: 'system' },
        `Automatically assigned because severity is ${severity}.`
      );
    }

    // Record audit event
    recordAudit(
      reporter_id || 'USR-REP-01',
      reporter_name || 'Alex Rivera',
      'reporter',
      'INCIDENT_CREATED',
      incidentId,
      `Registered incident ${incidentId} with severity ${severity} on ${affected_system}`
    );

    // Create notification if Critical or High
    if (severity === 'Critical' || severity === 'High') {
      createNotification(
        assignedId,
        'analyst',
        `New ${severity} Incident: ${incidentId}`,
        `"${title}" was submitted on ${affected_system} and assigned to you.`,
        'critical_incident',
        incidentId
      );
      createNotification(
        null,
        'manager',
        `Critical Alert: ${incidentId}`,
        `A ${severity} severity incident "${title}" requires response on ${affected_system}.`,
        'critical_incident',
        incidentId
      );
    }

    const created = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId);
    res.status(201).json({ incident: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/incidents/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.query; // role check
    const incident = db.prepare(`
      SELECT i.*,
        (SELECT MAX(ah.changed_at) FROM assignment_history ah
         WHERE ah.incident_id = i.id AND ah.new_owner_id = i.assigned_analyst_id) AS assignment_timestamp
      FROM incidents i WHERE i.id = ?
    `).get(id) as any;
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    // Actions
    const actions = db.prepare(`
      SELECT * FROM investigation_actions WHERE incident_id = ? ORDER BY timestamp ASC
    `).all(id);

    const evidenceLineIds = [...new Set(actions.flatMap((action: any) => {
      try {
        const refs = JSON.parse(action.evidence_refs || '[]');
        return Array.isArray(refs) ? refs.filter((ref: unknown) => Number.isSafeInteger(ref)) : [];
      } catch {
        return [];
      }
    }))];
    const actionEvidence = evidenceLineIds.length > 0
      ? db.prepare(`SELECT * FROM log_entries WHERE line_id IN (${evidenceLineIds.map(() => '?').join(',')})`)
        .all(...evidenceLineIds)
      : [];

    // Linked Log Evidence
    const linkedLogs = db.prepare(`
      SELECT l.*, lnk.id as link_id, lnk.reason, lnk.added_by, lnk.added_at
      FROM incident_log_links lnk
      JOIN log_entries l ON lnk.log_line_id = l.line_id
      WHERE lnk.incident_id = ?
      ORDER BY l.line_id ASC
    `).all(id);

    // Escalation Requests
    const escalations = db.prepare(`
      SELECT * FROM escalation_requests WHERE incident_id = ? ORDER BY requested_at DESC
    `).all(id);

    // Comments (Hide confidential comments if role is 'reporter')
    let commentQuery = 'SELECT * FROM comments WHERE incident_id = ?';
    if (role === 'reporter') {
      commentQuery += ' AND is_confidential = 0';
    }
    commentQuery += ' ORDER BY created_at ASC';
    const comments = db.prepare(commentQuery).all(id);

    // Audit Trail for this incident
    const auditTrail = db.prepare(`
      SELECT a.*,
        CASE WHEN a.actor_id IN ('USR-SEC-01', 'USR-SEC-02', 'USR-MGR-01', 'USR-REP-01') THEN 1 ELSE 0 END AS is_synthetic_demo_user
      FROM audit_events a WHERE a.incident_id = ? ORDER BY a.timestamp DESC
    `).all(id);

    res.json({
      incident,
      actions,
      actionEvidence,
      linkedLogs,
      escalations,
      comments,
      auditTrail
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update incident status and severity. Assignment changes use the audited assignment endpoints.
apiRouter.put('/incidents/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { status, severity } = req.body;
    const actor = respondForActor(req.body.user_id, res, ['manager']);
    if (!actor) return;
    if (req.body.assigned_analyst_id !== undefined || req.body.assigned_analyst_name !== undefined) {
      return res.status(400).json({ error: 'Use the audited assignment endpoint to change incident ownership.' });
    }

    const current = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as any;
    if (!current) return res.status(404).json({ error: 'Incident not found' });

    let newStatus = status || current.status;
    let newSeverity = severity || current.severity;
    if (newStatus === 'Resolved' && current.status !== 'Resolved') {
      return res.status(400).json({ error: 'Use the resolution workflow to record a confirmed incident resolution.' });
    }

    // If reopening a resolved incident:
    if (current.status === 'Resolved' && ['Open', 'Reopened'].includes(newStatus)) {
      newStatus = 'Reopened';
      createNotification(
        current.assigned_analyst_id,
        'analyst',
        `Incident Reopened: ${id}`,
        `Incident ${id} was reopened by ${actor.name}.`,
        'reopened',
        id
      );
    }

    db.prepare(`
      UPDATE incidents
      SET status = ?, severity = ?, resolved_at = CASE WHEN ? = 'Reopened' THEN NULL ELSE resolved_at END,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(newStatus, newSeverity, newStatus, id);

    recordAudit(
      actor.id,
      actor.name,
      actor.role,
      'INCIDENT_UPDATED',
      id,
      `Status: ${newStatus}, Assigned to: ${current.assigned_analyst_name || 'None'}, Severity: ${newSeverity}`
    );

    const updated = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
    res.json({ incident: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/incidents/:id/claim', (req, res) => {
  const actor = respondForActor(req.body.user_id, res, ['analyst']);
  if (!actor) return;

  let transactionStarted = false;
  try {
    db.exec('BEGIN IMMEDIATE');
    transactionStarted = true;
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id) as any;
    if (!incident) {
      db.exec('ROLLBACK');
      return res.status(404).json({ error: 'Incident not found.' });
    }
    if (incident.assigned_analyst_id) {
      db.exec('ROLLBACK');
      return res.status(409).json({
        error: incident.assigned_analyst_id === actor.id
          ? 'This incident has already been claimed by you.'
          : 'This incident has already been claimed by another analyst.',
        incident
      });
    }

    const update = db.prepare(`
      UPDATE incidents
      SET assigned_analyst_id = ?, assigned_analyst_name = ?, updated_at = datetime('now')
      WHERE id = ? AND assigned_analyst_id IS NULL
    `).run(actor.id, actor.name, req.params.id);
    if (Number(update.changes) !== 1) {
      db.exec('ROLLBACK');
      return res.status(409).json({ error: 'This incident has already been claimed by another analyst.' });
    }

    recordAssignment(req.params.id, null, null, actor.id, actor.name, actor, 'Claimed by analyst');
    recordAudit(actor.id, actor.name, actor.role, 'INCIDENT_CLAIMED', req.params.id, 'Analyst claimed an unassigned incident.');
    const updated = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id);
    db.exec('COMMIT');
    transactionStarted = false;
    res.json({ incident: updated });
  } catch (err: any) {
    if (transactionStarted) db.exec('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/incidents/:id/assignment', (req, res) => {
  const actor = respondForActor(req.body.user_id, res, ['manager']);
  if (!actor) return;
  const targetId = req.body.assigned_analyst_id;
  if (typeof targetId !== 'string' || !targetId.trim()) {
    return res.status(400).json({ error: 'Select a valid analyst account.' });
  }
  const target = db.prepare("SELECT id, name FROM users WHERE id = ? AND role = 'analyst'").get(targetId) as
    { id: string; name: string } | undefined;
  if (!target) return res.status(400).json({ error: 'The selected account is not a valid analyst.' });

  let transactionStarted = false;
  try {
    db.exec('BEGIN IMMEDIATE');
    transactionStarted = true;
    const current = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id) as any;
    if (!current) {
      db.exec('ROLLBACK');
      return res.status(404).json({ error: 'Incident not found.' });
    }
    if (current.assigned_analyst_id === target.id) {
      db.exec('ROLLBACK');
      return res.json({ incident: current });
    }
    db.prepare(`
      UPDATE incidents
      SET assigned_analyst_id = ?, assigned_analyst_name = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(target.id, target.name, req.params.id);
    recordAssignment(
      req.params.id,
      current.assigned_analyst_id,
      current.assigned_analyst_name,
      target.id,
      target.name,
      actor,
      typeof req.body.reason === 'string' ? req.body.reason : undefined
    );
    recordAudit(
      actor.id,
      actor.name,
      actor.role,
      current.assigned_analyst_id ? 'INCIDENT_REASSIGNED' : 'INCIDENT_ASSIGNED',
      req.params.id,
      `Assignment changed from ${current.assigned_analyst_name || 'Unassigned'} to ${target.name}.`
    );
    const updated = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id);
    db.exec('COMMIT');
    transactionStarted = false;
    res.json({ incident: updated });
  } catch (err: any) {
    if (transactionStarted) db.exec('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 4. Investigation Actions & Outcomes
// -------------------------------------------------------------
apiRouter.post('/incidents/:id/actions', (req, res) => {
  try {
    const { id } = req.params;
    const { description, result, notes, evidence_refs, follow_up_action, failure_reason } = req.body;
    const actor = respondForActor(req.body.user_id, res, ['analyst', 'manager']);
    if (!actor) return;

    if (!description || !result) {
      return res.status(400).json({ error: 'Description and result are required.' });
    }
    if (!['In Progress', 'Successful', 'Failed', 'Inconclusive'].includes(result)) {
      return res.status(400).json({ error: 'Select a valid investigation outcome.' });
    }
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as any;
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });
    if (!canWorkIncident(actor, incident, res)) return;

    const actionId = `ACT-${id.replace('INC-Z-', '')}-${Date.now().toString().slice(-4)}`;
    const refsJson = typeof evidence_refs === 'string' ? evidence_refs : JSON.stringify(evidence_refs || []);

    db.prepare(`
      INSERT INTO investigation_actions 
      (id, incident_id, analyst_id, analyst_name, description, timestamp, result, notes, evidence_refs, follow_up_action, failure_reason)
      VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?)
    `).run(
      actionId,
      id,
      actor.id,
      actor.name,
      description.trim(),
      result,
      notes || '',
      refsJson,
      follow_up_action || '',
      failure_reason || null
    );

    // If status was Open, advance to In Progress
    db.prepare(`
      UPDATE incidents 
      SET status = CASE WHEN status = 'Open' THEN 'In Progress' ELSE status END,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(id);

    const auditActionType = result === 'Failed' ? 'FAILED_ATTEMPT_RECORDED' : 'INVESTIGATION_ACTION_RECORDED';
    recordAudit(
      actor.id,
      actor.name,
      actor.role,
      auditActionType,
      id,
      `Recorded [${result}] action: ${description.slice(0, 100)}`
    );

    const created = db.prepare('SELECT * FROM investigation_actions WHERE id = ?').get(actionId);
    res.status(201).json({ action: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Record Incident Resolution (Outcome-Aware Incident Memory)
apiRouter.post('/incidents/:id/resolve', (req, res) => {
  try {
    const { id } = req.params;
    const { resolution_summary, resolution_evidence, verification_status } = req.body;
    const actor = respondForActor(req.body.user_id, res, ['analyst', 'manager']);
    if (!actor) return;

    if (!resolution_summary || !resolution_evidence) {
      return res.status(400).json({ error: 'Resolution summary and observed evidence are required.' });
    }
    if (!['Verified', 'Unverified', 'Incomplete'].includes(verification_status)) {
      return res.status(400).json({ error: 'Select a valid resolution verification status.' });
    }

    const inc = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as any;
    if (!inc) return res.status(404).json({ error: 'Incident not found' });
    if (!canWorkIncident(actor, inc, res)) return;

    // Calculate resolution time
    const createdAt = new Date(`${inc.created_at.replace(' ', 'T')}Z`).getTime();
    const minutes = Number.isFinite(createdAt) ? Math.max(0, Math.round((Date.now() - createdAt) / 60000)) : 0;

    const vStatus = verification_status;
    const kbId = `KB-MEM-${id.replace('INC-Z-', '')}`;

    db.prepare(`
      UPDATE incidents
      SET status = CASE WHEN ? = 'Verified' THEN 'Resolved' ELSE 'Unresolved' END,
          resolution_summary = ?,
          resolution_evidence = ?,
          resolution_procedure_id = ?,
          resolution_verified = ?,
          resolution_time_minutes = ?,
          resolved_at = CASE WHEN ? = 'Verified' THEN datetime('now') ELSE NULL END,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      vStatus,
      resolution_summary.trim(),
      resolution_evidence || 'Confirmed by analyst verification.',
      kbId,
      vStatus,
      vStatus === 'Verified' ? minutes : 0,
      vStatus,
      id
    );

    // Add or update Reusable Knowledge Base procedure
    db.prepare(`
      INSERT OR REPLACE INTO resolution_knowledge 
      (id, pattern_name, symptoms, component, verified_procedure, outcome_type, evidence_count, times_reused, author_analyst, created_at, updated_at, is_demo_data)
      VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, datetime('now'), datetime('now'), ?)
    `).run(
      kbId,
      inc.title,
      inc.description,
      inc.category,
      resolution_summary,
      vStatus,
      actor.name,
      inc.is_demo_data
    );

    recordAudit(
      actor.id,
      actor.name,
      actor.role,
      vStatus === 'Verified' ? 'INCIDENT_RESOLVED' : 'RESOLUTION_ATTEMPT_RECORDED',
      id,
      `${vStatus === 'Verified' ? 'Resolved' : 'Resolution attempt recorded; incident remains unresolved'} with ${vStatus} verification. Knowledge item ${kbId} saved to memory.`
    );

    // Notify Reporter
    if (inc.reporter_id) {
      createNotification(
        inc.reporter_id,
        'reporter',
        vStatus === 'Verified' ? `Incident Resolved: ${id}` : `Resolution Verification Needed: ${id}`,
        vStatus === 'Verified'
          ? `Your incident "${inc.title}" has been verified and resolved.`
          : `A resolution attempt was recorded for "${inc.title}", but the incident remains unresolved until verified.`,
        vStatus === 'Verified' ? 'incident_resolved' : 'resolution_unverified',
        id
      );
    }

    res.json({
      success: true,
      status: vStatus === 'Verified' ? 'Resolved' : 'Unresolved',
      kb_id: kbId,
      resolution_time_minutes: vStatus === 'Verified' ? minutes : 0
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 5. Escalation Workflow (Human-in-the-Loop)
// -------------------------------------------------------------
// Analyst requests escalation
apiRouter.post('/incidents/:id/escalate', (req, res) => {
  try {
    const { id } = req.params;
    const { reason, supporting_details } = req.body;
    const actor = respondForActor(req.body.user_id, res, ['analyst']);
    if (!actor) return;

    if (!reason) {
      return res.status(400).json({ error: 'Escalation reason and technical justification are required.' });
    }
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as any;
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });
    if (!canWorkIncident(actor, incident, res)) return;

    const reqId = `ESC-${id.replace('INC-Z-', '')}-${Date.now().toString().slice(-4)}`;

    db.prepare(`
      INSERT INTO escalation_requests 
      (id, incident_id, requested_by_id, requested_by_name, reason, supporting_details, status, requested_at)
      VALUES (?, ?, ?, ?, ?, ?, 'Pending', datetime('now'))
    `).run(
      reqId,
      id,
      actor.id,
      actor.name,
      reason.trim(),
      supporting_details || ''
    );

    // Update incident status
    db.prepare(`
      UPDATE incidents
      SET status = 'Escalation Requested', updated_at = datetime('now')
      WHERE id = ?
    `).run(id);

    recordAudit(
      actor.id,
      actor.name,
      actor.role,
      'ESCALATION_REQUESTED',
      id,
      `Submitted escalation ${reqId}: ${reason}`
    );

    // Notify Managers
    createNotification(
      null,
      'manager',
      `Escalation Pending Review: ${id}`,
      `Analyst ${actor.name} submitted escalation for incident ${id}: "${reason}"`,
      'escalation_requested',
      id
    );

    res.status(201).json({ escalation_id: reqId, status: 'Pending' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List escalations for manager
apiRouter.get('/escalations', (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT e.*, i.title, i.severity, i.affected_system, i.category, i.assigned_analyst_name
      FROM escalation_requests e
      JOIN incidents i ON e.incident_id = i.id
    `;
    const params: any[] = [];
    if (status && status !== 'all') {
      query += ' WHERE e.status = ?';
      params.push(status);
    }
    query += ' ORDER BY e.requested_at DESC';

    const escalations = db.prepare(query).all(...params);
    res.json({ escalations });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manager reviews escalation (Approve / Reject / Return)
apiRouter.post('/escalations/:id/review', (req, res) => {
  let transactionStarted = false;
  try {
    const { id } = req.params;
    const { decision, review_notes, reassign_to_id } = req.body;
    const actor = respondForActor(req.body.user_id, res, ['manager']);
    if (!actor) return;

    if (!['Approved', 'Rejected', 'Returned'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be Approved, Rejected, or Returned.' });
    }

    const esc = db.prepare('SELECT * FROM escalation_requests WHERE id = ?').get(id) as any;
    if (!esc) return res.status(404).json({ error: 'Escalation request not found' });
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(esc.incident_id) as any;
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });
    let target: { id: string; name: string } | undefined;
    if (decision === 'Approved' && reassign_to_id) {
      target = db.prepare("SELECT id, name FROM users WHERE id = ? AND role = 'analyst'").get(reassign_to_id) as
        { id: string; name: string } | undefined;
      if (!target) return res.status(400).json({ error: 'The selected account is not a valid analyst.' });
    }

    db.exec('BEGIN IMMEDIATE');
    transactionStarted = true;
    db.prepare(`
      UPDATE escalation_requests
      SET status = ?, reviewed_by_id = ?, reviewed_by_name = ?, review_notes = ?, target_analyst_id = ?, reviewed_at = datetime('now')
      WHERE id = ?
    `).run(
      decision,
      actor.id,
      actor.name,
      review_notes || '',
      target?.id || null,
      id
    );

    // Update incident status accordingly
    let incidentNewStatus = 'In Progress';
    if (decision === 'Approved') {
      incidentNewStatus = 'Escalated';
    } else if (decision === 'Returned') {
      incidentNewStatus = 'In Progress';
    } else if (decision === 'Rejected') {
      incidentNewStatus = 'In Progress';
    }

    let reassignmentClause = '';
    const updateParams: any[] = [incidentNewStatus];
    if (decision === 'Approved' && target) {
      reassignmentClause = ', assigned_analyst_id = ?, assigned_analyst_name = ?';
      updateParams.push(target.id, target.name);
    }
    updateParams.push(esc.incident_id);

    db.prepare(`
      UPDATE incidents
      SET status = ? ${reassignmentClause}, updated_at = datetime('now')
      WHERE id = ?
    `).run(...updateParams);

    if (decision === 'Approved' && target && target.id !== incident.assigned_analyst_id) {
      recordAssignment(
        incident.id,
        incident.assigned_analyst_id,
        incident.assigned_analyst_name,
        target.id,
        target.name,
        actor,
        'Reassigned during escalation approval'
      );
    }

    recordAudit(
      actor.id,
      actor.name,
      actor.role,
      `ESCALATION_${decision.toUpperCase()}`,
      esc.incident_id,
      `Manager decision: ${decision}. Notes: ${review_notes || 'None'}`
    );

    // Notify Requesting Analyst
    createNotification(
      esc.requested_by_id,
      'analyst',
      `Escalation ${decision}: ${esc.incident_id}`,
      `Manager ${actor.name} has ${decision.toLowerCase()} your escalation. Notes: ${review_notes || 'None'}`,
      'escalation_decision',
      esc.incident_id
    );

    db.exec('COMMIT');
    transactionStarted = false;
    res.json({ success: true, decision, status: incidentNewStatus });
  } catch (err: any) {
    if (transactionStarted) db.exec('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 6. Log Explorer & CSV Dataset Pipeline
// -------------------------------------------------------------
apiRouter.get('/logs', (req, res) => {
  try {
    const {
      component,
      event_id,
      search,
      month,
      date,
      time,
      limit = '50',
      offset = '0'
    } = req.query;
    let query = 'SELECT * FROM log_entries WHERE 1=1';
    const params: any[] = [];

    if (component && component !== 'all') {
      query += ' AND component = ?';
      params.push(component);
    }
    if (event_id && event_id !== 'all') {
      query += ' AND event_id = ?';
      params.push(event_id);
    }
    if (month) {
      query += ' AND month = ?';
      params.push(month);
    }
    if (date) {
      query += ' AND date = ?';
      params.push(date);
    }
    if (time) {
      if (typeof time !== 'string' || !/^\d{2}:\d{2}(?::\d{2})?$/.test(time)) {
        return res.status(400).json({ error: 'time must use HH:MM or HH:MM:SS from the source CSV.' });
      }
      query += ' AND time LIKE ?';
      params.push(`${time}%`);
    }
    if (search) {
      query += ' AND (content LIKE ? OR component LIKE ? OR event_template LIKE ?)';
      const t = `%${search}%`;
      params.push(t, t, t);
    }

    // Count matching
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as cnt');
    const totalMatch = (db.prepare(countQuery).get(...params) as any).cnt;

    query += ' ORDER BY line_id ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string, 10), parseInt(offset as string, 10));

    const logs = db.prepare(query).all(...params);

    // Components list for filter
    const components = db.prepare(`
      SELECT DISTINCT component, COUNT(*) as count 
      FROM log_entries 
      WHERE component != '' 
      GROUP BY component 
      ORDER BY count DESC
    `).all();

    // Event IDs list
    const eventIds = db.prepare(`
      SELECT DISTINCT event_id, COUNT(*) as count 
      FROM log_entries 
      WHERE event_id != '' 
      GROUP BY event_id 
      ORDER BY count DESC 
      LIMIT 20
    `).all();

    const months = db.prepare(`
      SELECT DISTINCT month FROM log_entries
      WHERE month != '' ORDER BY month
    `).all();

    res.json({
      logs,
      total: totalMatch,
      components,
      eventIds,
      months
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Link Log Line as Evidence to Incident
apiRouter.post('/incidents/:id/logs', (req, res) => {
  try {
    const { id } = req.params;
    const { line_id, reason } = req.body;
    const actor = respondForActor(req.body.user_id, res, ['analyst', 'manager']);
    if (!actor) return;
    if (!Number.isSafeInteger(line_id)) {
      return res.status(400).json({ error: 'line_id must be a valid source line ID.' });
    }

    const incident = db.prepare('SELECT assigned_analyst_id FROM incidents WHERE id = ?').get(id) as
      { assigned_analyst_id: string | null } | undefined;
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });
    if (!canWorkIncident(actor, incident, res)) return;

    const logEntry = db.prepare('SELECT line_id FROM log_entries WHERE line_id = ?').get(line_id);
    if (!logEntry) return res.status(404).json({ error: 'Source log line not found.' });

    const linkId = `LNK-${Date.now()}-${line_id}`;
    db.prepare(`
      INSERT OR REPLACE INTO incident_log_links (id, incident_id, log_line_id, reason, added_by, added_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(linkId, id, line_id, reason?.trim() || 'Referenced evidence from Log Explorer', actor.name);

    recordAudit(
      actor.id,
      actor.name,
      actor.role,
      'LOG_EVIDENCE_LINKED',
      id,
      `Linked log line #${line_id} as supporting evidence: "${reason?.trim() || 'Evidence link'}"`
    );

    res.json({ success: true, link_id: linkId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Dataset Import / Re-import endpoint
apiRouter.post('/logs/import', (req, res) => {
  try {
    const { csv_content, dataset_name = 'Linux_2k.log_structured.csv' } = req.body;

    if (typeof dataset_name !== 'string' || !dataset_name.trim() || dataset_name.length > 200) {
      return res.status(400).json({ error: 'dataset_name must be a non-empty string of at most 200 characters.' });
    }
    if (csv_content !== undefined && typeof csv_content !== 'string') {
      return res.status(400).json({ error: 'csv_content must be a CSV string.' });
    }

    let contentToParse: string;
    let isBundledLogHubDataset = false;
    if (typeof csv_content === 'string' && csv_content.length > 0) {
      contentToParse = csv_content;
    } else {
      const defaultPath = path.resolve(process.cwd(), 'data', 'Linux_2k.log_structured.csv');
      if (!fs.existsSync(defaultPath)) {
        return res.status(400).json({ error: 'No CSV content supplied and default dataset file not found.' });
      }
      contentToParse = fs.readFileSync(defaultPath, 'utf-8');
      isBundledLogHubDataset = true;
    }

    const result = importLogCsv(contentToParse, dataset_name.trim(), isBundledLogHubDataset);

    recordAudit(
      'SYSTEM',
      'Dataset Ingestion Pipeline',
      'analyst',
      'DATASET_IMPORTED',
      null,
      `Imported ${result.imported} new rows from ${result.datasetName}; skipped ${result.skipped}.`
    );

    res.json({
      success: true,
      import_id: result.importId,
      total_processed: result.totalProcessed,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors,
      dataset_name: result.datasetName
    });
  } catch (err: any) {
    if (err instanceof InvalidCsvError) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// Import history status
apiRouter.get('/logs/imports', (req, res) => {
  const imports = db.prepare('SELECT * FROM dataset_imports ORDER BY import_time DESC').all();
  res.json({ imports });
});

// -------------------------------------------------------------
// 7. Similar Incident Search
// -------------------------------------------------------------
apiRouter.post('/similarity/search', (req, res) => {
  try {
    const { title, description, affected_system, category, log_content, component, exclude_incident_id } = req.body;
    const matches = findSimilarIncidents({
      title,
      description,
      affected_system,
      category,
      log_content,
      component,
      exclude_incident_id
    });

    res.json({
      matches,
      total_matches: matches.length,
      method: 'Keyword-frequency cosine similarity',
      recorded_verified_outcomes_count: matches.filter(m => m.outcome_type === 'Verified').length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 8. Recommendations (Rule-based & AI-assisted)
// -------------------------------------------------------------
apiRouter.get('/recommendations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const recommendation = await getRecommendations(id);
    res.json(recommendation);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 9. Chatbot Assistant
// -------------------------------------------------------------
apiRouter.post('/chat', async (req, res) => {
  try {
    const { message, role = 'analyst', userId = 'USR-SEC-01', incidentId, history } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const reply = await handleAssistantChat({
      message,
      role,
      userId,
      incidentId,
      history
    });

    res.json(reply);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 10. Comments & Collaboration
// -------------------------------------------------------------
apiRouter.post('/incidents/:id/comments', (req, res) => {
  try {
    const { id } = req.params;
    const { content, is_confidential = 0, user_id, user_name, user_role } = req.body;

    if (!content) return res.status(400).json({ error: 'Comment content is required.' });

    // Reporters cannot create confidential comments
    const confidential = user_role === 'reporter' ? 0 : (is_confidential ? 1 : 0);
    const commentId = `CMT-${Date.now()}`;

    db.prepare(`
      INSERT INTO comments (id, incident_id, author_id, author_name, author_role, content, is_confidential, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      commentId,
      id,
      user_id || 'USR-REP-01',
      user_name || 'Alex Rivera',
      user_role || 'reporter',
      content.trim(),
      confidential
    );

    recordAudit(
      user_id || 'USR-REP-01',
      user_name || 'Alex Rivera',
      user_role || 'reporter',
      'COMMENT_ADDED',
      id,
      `Added comment (${confidential ? 'Confidential' : 'Public'})`
    );

    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
    res.status(201).json({ comment });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 11. Notifications
// -------------------------------------------------------------
apiRouter.get('/notifications', (req, res) => {
  try {
    const { user_id, role } = req.query;
    let audience = '';
    const params: any[] = [];

    if (role === 'reporter') {
      audience = 'user_id = ?';
      params.push(user_id);
    } else if (role === 'manager') {
      audience = '(user_role = ? OR user_id = ? OR user_role IS NULL)';
      params.push('manager', user_id);
    } else {
      audience = '(user_role = ? OR user_id = ?)';
      params.push('analyst', user_id);
    }

    const query = `SELECT * FROM notifications WHERE ${audience} ORDER BY created_at DESC LIMIT 50`;
    const notifications = db.prepare(query).all(...params);
    const unreadCount = (db.prepare(`SELECT COUNT(*) as unread FROM notifications WHERE ${audience} AND read = 0`).get(...params) as any).unread;

    res.json({ notifications, unread_count: unreadCount || 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/notifications/:id/read', (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'all') {
      db.prepare('UPDATE notifications SET read = 1').run();
    } else {
      db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 12. Audit Trail
// -------------------------------------------------------------
apiRouter.get('/audit', (req, res) => {
  try {
    const { limit = '100' } = req.query;
    const events = db.prepare(`
      SELECT a.*,
        CASE WHEN a.actor_id IN ('USR-SEC-01', 'USR-SEC-02', 'USR-MGR-01', 'USR-REP-01') THEN 1 ELSE 0 END AS is_synthetic_demo_user
      FROM audit_events a ORDER BY a.timestamp DESC LIMIT ?
    `).all(parseInt(limit as string, 10));
    res.json({ events });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 13. Resolution Knowledge Base
// -------------------------------------------------------------
apiRouter.get('/knowledge', (req, res) => {
  try {
    const items = db.prepare(`
      SELECT id, pattern_name, symptoms, component, verified_procedure,
        failed_actions_summary, outcome_type, evidence_count, NULL AS times_reused,
        author_analyst, created_at, updated_at, is_demo_data
      FROM resolution_knowledge
      ORDER BY created_at DESC, id
    `).all();
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 14. Demo Reset Endpoint
// -------------------------------------------------------------
apiRouter.post('/demo/reset', (req, res) => {
  try {
    seedInitialDataIfEmpty(true);
    recordAudit('SYSTEM', 'Demo Controller', 'manager', 'DEMO_DATA_RESET', null, 'Reset demo incidents and escalation queue to clean baseline.');
    res.json({ success: true, message: 'Demo data reset successfully without affecting imported logs.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
