export type Role = 'analyst' | 'manager' | 'reporter';

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  email: string;
  avatar: string;
  is_demo_user?: number;
}

export interface AIAvailability {
  state: 'checking' | 'available' | 'configured-unavailable' | 'configured-unverified' | 'not-configured';
  message?: string;
  lastCheckedAt?: string;
}

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export type IncidentStatus = 
  | 'Open' 
  | 'In Progress' 
  | 'Resolved' 
  | 'Unresolved' 
  | 'Escalation Requested' 
  | 'Escalated' 
  | 'Reopened';

export interface Incident {
  id: string;
  title: string;
  description: string;
  affected_system: string;
  severity: Severity;
  category: string;
  reporter_id: string;
  reporter_name: string;
  assigned_analyst_id: string | null;
  assigned_analyst_name: string | null;
  status: IncidentStatus;
  is_demo_data: number;
  created_at: string;
  updated_at: string;
  assignment_timestamp?: string | null;
  resolved_at?: string | null;
  resolution_summary: string | null;
  resolution_evidence: string | null;
  resolution_procedure_id: string | null;
  resolution_verified: 'Verified' | 'Unverified' | 'Incomplete' | 'None';
  resolution_time_minutes: number;
}

export interface InvestigationAction {
  id: string;
  incident_id: string;
  analyst_id: string;
  analyst_name: string;
  description: string;
  timestamp: string;
  result: 'In Progress' | 'Successful' | 'Failed' | 'Inconclusive';
  notes: string;
  evidence_refs: string; // JSON array of line numbers
  follow_up_action: string;
  failure_reason: string | null;
  created_at: string;
}

export interface LogEntry {
  line_id: number;
  month: string;
  date: string;
  time: string;
  level: string;
  component: string;
  pid: string;
  content: string;
  event_id: string;
  event_template: string;
  dataset_name: string;
  imported_at: string;
}

export interface IncidentLogLink {
  id: string;
  incident_id: string;
  log_line_id: number;
  line_id?: number;
  month?: string;
  date?: string;
  time?: string;
  level?: string;
  component?: string;
  pid?: string;
  content?: string;
  event_id?: string;
  event_template?: string;
  dataset_name?: string;
  reason: string;
  added_by: string;
  added_at: string;
}

export interface EscalationRequest {
  id: string;
  incident_id: string;
  title?: string;
  severity?: Severity;
  affected_system?: string;
  category?: string;
  assigned_analyst_name?: string;
  requested_by_id: string;
  requested_by_name: string;
  reason: string;
  supporting_details: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Returned';
  reviewed_by_id: string | null;
  reviewed_by_name: string | null;
  review_notes: string | null;
  target_analyst_id: string | null;
  requested_at: string;
  reviewed_at: string | null;
}

export interface NotificationItem {
  id: string;
  user_id: string | null;
  user_role: string | null;
  title: string;
  message: string;
  type: string;
  incident_id: string | null;
  read: number;
  created_at: string;
}

export interface CommentItem {
  id: string;
  incident_id: string;
  author_id: string;
  author_name: string;
  author_role: Role;
  content: string;
  is_confidential: number;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  incident_id: string | null;
  details: string;
  timestamp: string;
  is_seeded_demo_data: number;
  is_synthetic_demo_user: number;
}

export interface ResolutionKnowledge {
  id: string;
  pattern_name: string;
  symptoms: string;
  component: string;
  verified_procedure: string;
  failed_actions_summary: string | null;
  outcome_type: 'Verified' | 'Unverified' | 'Incomplete';
  evidence_count: number;
  times_reused: number | null;
  author_analyst: string;
  created_at: string;
  updated_at: string;
  is_demo_data: number;
}

export interface SimilarityMatch {
  incident_id: string;
  title: string;
  status: IncidentStatus;
  severity: Severity;
  affected_system: string;
  similarity_score: number;
  similarity_percentage: number;
  similarity_label: 'Low Similarity' | 'Moderate Similarity' | 'High Similarity';
  matching_terms: string[];
  recorded_actions_count: number;
  successful_actions_count: number;
  failed_actions_count: number;
  outcome_type: 'Verified' | 'Unverified' | 'Incomplete' | 'None';
  resolution_summary: string | null;
  resolution_evidence: string | null;
  is_demo_data: boolean;
}

export interface AnalyticsOverview {
  metrics: {
    total_incidents: number;
    open_incidents: number;
    in_progress_incidents: number;
    resolved_incidents: number;
    unresolved_incidents: number;
    escalated_incidents: number;
    critical_incidents: number;
    high_incidents: number;
    verified_resolutions: number;
    active_incidents: number;
    resolution_success_rate: number | null;
    resolution_attempts: number;
    unassigned_incidents: number;
    pending_escalation_reviews: number;
    avg_resolution_time_minutes: number;
    successful_actions: number;
    failed_actions: number;
    total_log_evidence: number;
  };
  charts: {
    severity_distribution: Array<{ severity: string; count: number }>;
    status_distribution: Array<{ status: string; count: number }>;
    system_distribution: Array<{ affected_system: string; count: number }>;
    log_components: Array<{ component: string; count: number }>;
    analyst_workload: Array<{ analyst_id: string; analyst: string; total_assigned: number; resolved: number; active: number }>;
    action_distribution: Array<{ result: string; count: number }>;
    escalation_distribution: Array<{ status: string; count: number }>;
    incident_trends: Array<{ day: string; opened: number; resolved: number }>;
  };
}

export interface IncidentAnalyticsFilter {
  statuses?: IncidentStatus[];
  analystId?: string;
  unassigned?: boolean;
}
