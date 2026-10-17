import {
  Incident,
  InvestigationAction,
  LogEntry,
  EscalationRequest,
  NotificationItem,
  AuditEvent,
  ResolutionKnowledge,
  SimilarityMatch,
  AnalyticsOverview,
  User,
  Role,
  AIAvailability
} from '../types';

const BASE_URL = '/api';

export const api = {
  // Auth & Roles
  async getUsers(): Promise<{ users: User[]; aiAvailable: boolean }> {
    const res = await fetch(`${BASE_URL}/auth/users`);
    return res.json();
  },

  async getStatus(): Promise<{ aiAvailable: boolean; aiModel: string; aiStatus: AIAvailability; environment: string }> {
    const res = await fetch(`${BASE_URL}/auth/status`);
    if (!res.ok) throw new Error(`AI status request failed (${res.status}).`);
    return res.json();
  },

  // Analytics
  async getOverview(): Promise<AnalyticsOverview> {
    const res = await fetch(`${BASE_URL}/analytics/overview`);
    return res.json();
  },

  // Incidents
  async getIncidents(params?: {
    status?: string;
    severity?: string;
    system?: string;
    analyst?: string;
    reporter_id?: string;
    search?: string;
  }): Promise<{ incidents: Incident[] }> {
    const q = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v && v !== 'all') q.append(k, v);
      });
    }
    const res = await fetch(`${BASE_URL}/incidents?${q.toString()}`);
    return res.json();
  },

  async getIncident(id: string, role?: Role) {
    const q = role ? `?role=${role}` : '';
    const res = await fetch(`${BASE_URL}/incidents/${id}${q}`);
    return res.json();
  },

  async createIncident(data: {
    title: string;
    description: string;
    affected_system: string;
    severity: string;
    category?: string;
    reporter_id: string;
    reporter_name: string;
  }): Promise<{ incident: Incident }> {
    const res = await fetch(`${BASE_URL}/incidents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create incident');
    }
    return res.json();
  },

  async updateIncident(id: string, data: any): Promise<{ incident: Incident }> {
    const res = await fetch(`${BASE_URL}/incidents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update incident');
    }
    return res.json();
  },

  async claimIncident(id: string, userId: string): Promise<{ incident: Incident }> {
    const res = await fetch(`${BASE_URL}/incidents/${id}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to claim incident');
    }
    return res.json();
  },

  async assignIncident(id: string, data: {
    assigned_analyst_id: string;
    user_id: string;
    reason?: string;
  }): Promise<{ incident: Incident }> {
    const res = await fetch(`${BASE_URL}/incidents/${id}/assignment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to assign incident');
    }
    return res.json();
  },

  // Actions
  async recordAction(incidentId: string, data: {
    description: string;
    result: string;
    notes?: string;
    evidence_refs?: number[];
    follow_up_action?: string;
    failure_reason?: string;
    user_id: string;
    user_name: string;
    user_role: Role;
  }): Promise<{ action: InvestigationAction }> {
    const res = await fetch(`${BASE_URL}/incidents/${incidentId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to record action');
    }
    return res.json();
  },

  // Resolution
  async resolveIncident(incidentId: string, data: {
    resolution_summary: string;
    resolution_evidence: string;
    verification_status: string;
    user_id: string;
    user_name: string;
    user_role: Role;
  }) {
    const res = await fetch(`${BASE_URL}/incidents/${incidentId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to resolve incident');
    }
    return res.json();
  },

  // Escalation
  async requestEscalation(incidentId: string, data: {
    reason: string;
    supporting_details: string;
    user_id: string;
    user_name: string;
    user_role: Role;
  }): Promise<{ escalation_id: string; status: string }> {
    const res = await fetch(`${BASE_URL}/incidents/${incidentId}/escalate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to request escalation');
    }
    return res.json();
  },

  async getEscalations(status?: string): Promise<{ escalations: EscalationRequest[] }> {
    const q = status && status !== 'all' ? `?status=${status}` : '';
    const res = await fetch(`${BASE_URL}/escalations${q}`);
    return res.json();
  },

  async reviewEscalation(escalationId: string, data: {
    decision: 'Approved' | 'Rejected' | 'Returned';
    review_notes: string;
    reassign_to_id?: string;
    reassign_to_name?: string;
    user_id: string;
    user_name: string;
    user_role: Role;
  }) {
    const res = await fetch(`${BASE_URL}/escalations/${escalationId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to review escalation');
    }
    return res.json();
  },

  // Logs
  async getLogs(params: {
    component?: string;
    event_id?: string;
    search?: string;
    month?: string;
    date?: string;
    time?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    logs: LogEntry[];
    total: number;
    components: Array<{ component: string; count: number }>;
    eventIds: Array<{ event_id: string; count: number }>;
    months: Array<{ month: string }>;
  }> {
    const q = new URLSearchParams();
    if (params.component && params.component !== 'all') q.append('component', params.component);
    if (params.event_id && params.event_id !== 'all') q.append('event_id', params.event_id);
    if (params.search) q.append('search', params.search);
    if (params.month) q.append('month', params.month);
    if (params.date) q.append('date', params.date);
    if (params.time) q.append('time', params.time);
    if (params.limit) q.append('limit', params.limit.toString());
    if (params.offset) q.append('offset', params.offset.toString());

    const res = await fetch(`${BASE_URL}/logs?${q.toString()}`);
    return res.json();
  },

  async linkLogEvidence(incidentId: string, data: {
    line_id: number;
    reason: string;
    user_id: string;
  }) {
    const res = await fetch(`${BASE_URL}/incidents/${incidentId}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to link log evidence');
    }
    return res.json();
  },

  async importLogs(csvContent?: string, datasetName?: string) {
    const res = await fetch(`${BASE_URL}/logs/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv_content: csvContent, dataset_name: datasetName })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Import failed');
    }
    return res.json();
  },

  async getImportHistory() {
    const res = await fetch(`${BASE_URL}/logs/imports`);
    return res.json();
  },

  // Similarity Search
  async searchSimilarity(data: {
    title?: string;
    description?: string;
    affected_system?: string;
    category?: string;
    log_content?: string;
    component?: string;
    exclude_incident_id?: string;
  }): Promise<{
    matches: SimilarityMatch[];
    total_matches: number;
    method: string;
    recorded_verified_outcomes_count: number;
  }> {
    const res = await fetch(`${BASE_URL}/similarity/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // Recommendations
  async getRecommendations(incidentId: string) {
    const res = await fetch(`${BASE_URL}/recommendations/${incidentId}`);
    return res.json();
  },

  // Chat
  async sendChatMessage(data: {
    message: string;
    role: Role;
    userId: string;
    incidentId?: string;
  }): Promise<{ reply: string; source_incidents?: string[]; mode: 'rule-based' | 'ai-assisted' }> {
    const res = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // Comments
  async addComment(incidentId: string, data: {
    content: string;
    is_confidential?: boolean;
    user_id: string;
    user_name: string;
    user_role: Role;
  }) {
    const res = await fetch(`${BASE_URL}/incidents/${incidentId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // Notifications
  async getNotifications(params: { user_id: string; role: Role }): Promise<{
    notifications: NotificationItem[];
    unread_count: number;
  }> {
    const res = await fetch(`${BASE_URL}/notifications?user_id=${params.user_id}&role=${params.role}`);
    return res.json();
  },

  async markNotificationRead(id: string) {
    const res = await fetch(`${BASE_URL}/notifications/${id}/read`, { method: 'PUT' });
    return res.json();
  },

  // Audit
  async getAuditTrail(): Promise<{ events: AuditEvent[] }> {
    const res = await fetch(`${BASE_URL}/audit`);
    return res.json();
  },

  // Knowledge Base
  async getKnowledgeBase(): Promise<{ items: ResolutionKnowledge[] }> {
    const res = await fetch(`${BASE_URL}/knowledge`);
    return res.json();
  },

  // Demo Reset
  async resetDemoData() {
    const res = await fetch(`${BASE_URL}/demo/reset`, { method: 'POST' });
    return res.json();
  }
};
