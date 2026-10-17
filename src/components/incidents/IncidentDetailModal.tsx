import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  Clock,
  User,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowUpRight,
  Plus,
  Terminal,
  MessageSquare,
  Sparkles,
  GitCompare,
  FileCheck,
  Share2,
  Lock,
  RefreshCw,
  Send
} from 'lucide-react';
import { Incident, InvestigationAction, IncidentLogLink, EscalationRequest, CommentItem, AuditEvent, Role, User as UserType, LogEntry } from '../../types';
import { StatusBadge, SeverityBadge } from '../common/Badge';
import { api } from '../../services/api';

interface IncidentDetailModalProps {
  incidentId: string | null;
  onClose: () => void;
  currentUser: UserType;
  onRefreshIncidents: () => void;
  onOpenRecordActionModal: (incidentId: string) => void;
  onOpenResolveModal: (incidentId: string) => void;
  onOpenEscalateModal: (incidentId: string) => void;
  onOpenReviewEscalationModal: (escalationId: string, incidentId: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  incidentId,
  onClose,
  currentUser,
  onRefreshIncidents,
  onOpenRecordActionModal,
  onOpenResolveModal,
  onOpenEscalateModal,
  onOpenReviewEscalationModal,
  onNavigateTab
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'timeline' | 'evidence' | 'similarity' | 'recommendations' | 'collaboration' | 'audit'>('timeline');
  const [data, setData] = useState<{
    incident: Incident;
    actions: InvestigationAction[];
    actionEvidence: LogEntry[];
    linkedLogs: IncidentLogLink[];
    escalations: EscalationRequest[];
    comments: CommentItem[];
    auditTrail: AuditEvent[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [loadingRec, setLoadingRec] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [isConfidential, setIsConfidential] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);

  const isReporter = currentUser.role === 'reporter';
  const isManager = currentUser.role === 'manager';
  const isAnalyst = currentUser.role === 'analyst';

  const fetchDetails = async () => {
    if (!incidentId) return;
    try {
      setLoading(true);
      const res = await api.getIncident(incidentId, currentUser.role);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [incidentId, currentUser.role]);

  // Load recommendations when tab is selected
  useEffect(() => {
    if (activeSubTab === 'recommendations' && incidentId && !recommendation) {
      setLoadingRec(true);
      api.getRecommendations(incidentId)
        .then(setRecommendation)
        .catch(console.error)
        .finally(() => setLoadingRec(false));
    }
  }, [activeSubTab, incidentId]);

  if (!incidentId) return null;

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || submittingComment) return;
    try {
      setSubmittingComment(true);
      await api.addComment(incidentId, {
        content: commentInput,
        is_confidential: isConfidential,
        user_id: currentUser.id,
        user_name: currentUser.name,
        user_role: currentUser.role
      });
      setCommentInput('');
      fetchDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const inc = data?.incident;
  const pendingEscalation = data?.escalations?.find(e => e.status === 'Pending');
  const canInvestigate = Boolean(inc && (isManager || (isAnalyst && inc.assigned_analyst_id === currentUser.id)));

  const claimIncident = async () => {
    if (!inc) return;
    setOwnershipError(null);
    try {
      await api.claimIncident(inc.id, currentUser.id);
      await fetchDetails();
      onRefreshIncidents();
    } catch (err) {
      setOwnershipError(err instanceof Error ? err.message : 'Failed to claim incident.');
      await fetchDetails();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-5xl bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 my-6 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800/80 bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-cyan-400 font-bold text-sm">{inc?.id}</span>
              <SeverityBadge severity={inc?.severity || 'Medium'} />
              <StatusBadge status={inc?.status || 'Open'} />
              {inc?.is_demo_data === 1 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded">
                  DEMO DATA
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-100">{inc?.title}</h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span>System: <strong className="text-slate-200">{inc?.affected_system}</strong></span>
              <span>·</span>
              <span>Reporter: <strong className="text-slate-200">{inc?.reporter_name}</strong></span>
              <span>·</span>
              <span>Assigned: <strong className="text-slate-200">{inc?.assigned_analyst_name || 'Unassigned'}</strong></span>
              {inc?.assignment_timestamp && (
                <>
                  <span>·</span>
                  <span>Assigned at: <strong className="text-slate-200">{inc.assignment_timestamp}</strong></span>
                </>
              )}
            </div>
            {!canInvestigate && isAnalyst && (
              <p className="mt-2 text-xs text-amber-300">
                {inc?.assigned_analyst_id
                  ? `Owned by ${inc.assigned_analyst_name}. Ask a manager to reassign it.`
                  : 'Claim this incident before investigating it.'}
              </p>
            )}
            {ownershipError && <p role="alert" className="mt-2 text-xs text-rose-300">{ownershipError}</p>}
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 shrink-0">
            {isAnalyst && inc && !inc.assigned_analyst_id && (
              <button
                onClick={claimIncident}
                className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg"
              >
                Claim Incident
              </button>
            )}
            {/* Record Action (Analyst/Manager) */}
            {canInvestigate && inc?.status !== 'Resolved' && (
              <button
                onClick={() => onOpenRecordActionModal(inc!.id)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                <span>Record Action</span>
              </button>
            )}

            {/* Request Escalation (Analyst only) */}
            {canInvestigate && isAnalyst && inc?.status !== 'Resolved' && inc?.status !== 'Escalation Requested' && (
              <button
                onClick={() => onOpenEscalateModal(inc!.id)}
                className="px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-950/40 hover:bg-amber-900/40 border border-amber-800/60 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Request Escalation</span>
              </button>
            )}

            {/* Manager Review Escalation */}
            {isManager && pendingEscalation && (
              <button
                onClick={() => onOpenReviewEscalationModal(pendingEscalation.id, inc!.id)}
                className="px-3 py-1.5 text-xs font-semibold text-purple-200 bg-purple-900 hover:bg-purple-800 border border-purple-700 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Review Escalation</span>
              </button>
            )}

            {/* Mark as Resolved */}
            {canInvestigate && inc?.status !== 'Resolved' && (
              <button
                onClick={() => onOpenResolveModal(inc!.id)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark Resolved</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center gap-1 px-6 border-b border-slate-800/80 bg-slate-950/40 text-xs font-medium overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('timeline')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors whitespace-nowrap ${
              activeSubTab === 'timeline'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Investigation Timeline ({data?.actions?.length || 0})
          </button>

          <button
            onClick={() => setActiveSubTab('evidence')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors whitespace-nowrap ${
              activeSubTab === 'evidence'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Log Evidence ({data?.linkedLogs?.length || 0})
          </button>

          <button
            onClick={() => setActiveSubTab('recommendations')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTab === 'recommendations'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Recommendations & Outcome Memory</span>
          </button>

          <button
            onClick={() => setActiveSubTab('collaboration')}
            className={`py-3 px-3 border-b-2 font-medium transition-colors whitespace-nowrap ${
              activeSubTab === 'collaboration'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Collaboration & Updates ({data?.comments?.length || 0})
          </button>

          {!isReporter && (
            <button
              onClick={() => setActiveSubTab('audit')}
              className={`py-3 px-3 border-b-2 font-medium transition-colors whitespace-nowrap ${
                activeSubTab === 'audit'
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Audit Trail ({data?.auditTrail?.length || 0})
            </button>
          )}
        </div>

        {/* Tab Body */}
        <div className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400" />
              <p className="text-xs text-slate-400">Retrieving incident memory records from SQLite...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: Investigation Timeline */}
              {activeSubTab === 'timeline' && (
                <div className="space-y-6">
                  {/* Resolution Banner if resolved */}
                  {inc?.status === 'Resolved' && (
                    <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>RESOLVED OUTCOME · Procedure Saved to Incident Memory</span>
                        </div>
                        <span className="text-[11px] font-mono text-emerald-400/80">
                          Verified Status: {inc.resolution_verified}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200">{inc.resolution_summary}</p>
                      {inc.resolution_evidence && (
                        <p className="text-[11px] text-slate-400 font-mono">
                          Supporting Evidence: {inc.resolution_evidence}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Pending Escalation Warning Banner */}
                  {pendingEscalation && (
                    <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/80 space-y-1">
                      <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>PENDING ESCALATION REVIEW</span>
                      </div>
                      <p className="text-xs text-slate-300">
                        Requested by {pendingEscalation.requested_by_name}: "{pendingEscalation.reason}"
                      </p>
                      {isManager && (
                        <button
                          onClick={() => onOpenReviewEscalationModal(pendingEscalation.id, inc!.id)}
                          className="mt-2 px-3 py-1 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded transition-colors"
                        >
                          Review Request Now
                        </button>
                      )}
                    </div>
                  )}

                  {/* Actions Chronological List */}
                  <div>
                    <h3 className="text-xs font-mono uppercase text-slate-400 tracking-wider mb-4">
                      Chronological Investigation Actions ({data?.actions?.length || 0})
                    </h3>

                    {data?.actions?.length === 0 ? (
                      <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl space-y-2">
                        <Clock className="w-8 h-8 text-slate-600 mx-auto" />
                        <p className="text-xs text-slate-400">No investigation actions recorded yet.</p>
                        {!isReporter && (
                          <button
                            onClick={() => onOpenRecordActionModal(inc!.id)}
                            className="mt-2 px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 rounded-lg hover:bg-cyan-900/60 transition-colors"
                          >
                            Record Initial Action
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
                        {data?.actions.map((act) => {
                          let badgeBg = 'bg-slate-800 text-slate-300';
                          let icon = <HelpCircle className="w-3.5 h-3.5" />;

                          if (act.result === 'Successful') {
                            badgeBg = 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60';
                            icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
                          } else if (act.result === 'Failed') {
                            badgeBg = 'bg-rose-950/60 text-rose-300 border border-rose-800/60';
                            icon = <XCircle className="w-3.5 h-3.5 text-rose-400" />;
                          } else if (act.result === 'In Progress') {
                            badgeBg = 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/60';
                            icon = <Clock className="w-3.5 h-3.5 text-cyan-400" />;
                          }

                          let refs: number[] = [];
                          try {
                            refs = JSON.parse(act.evidence_refs || '[]');
                          } catch (e) {}

                          return (
                            <div key={act.id} className="relative group">
                              {/* Dot on line */}
                              <div className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-slate-900 border-2 border-cyan-500" />

                              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-2 hover:border-slate-700 transition-colors">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded ${badgeBg}`}>
                                      {icon}
                                      <span>{act.result}</span>
                                    </span>
                                    <span className="text-xs font-semibold text-slate-200">
                                      {act.description}
                                    </span>
                                  </div>
                                  <span className="text-[11px] font-mono text-slate-400">
                                    {act.timestamp}
                                  </span>
                                </div>

                                {act.notes && (
                                  <p className="text-xs text-slate-300 leading-relaxed pl-1 border-l-2 border-slate-700">
                                    {act.notes}
                                  </p>
                                )}

                                {act.failure_reason && (
                                  <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-900/60 text-xs text-rose-300">
                                    <strong>Failure Root Cause:</strong> {act.failure_reason}
                                    <p className="text-[11px] text-rose-400/80 mt-0.5">
                                      Preserved in incident memory to prevent future repetition of failed procedure.
                                    </p>
                                  </div>
                                )}

                                {refs.length > 0 && (
                                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                    <Terminal className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Referenced Log Lines:</span>
                                    {refs.map(r => (
                                      <span key={r} className="font-mono text-cyan-400 bg-slate-800 px-1 rounded">
                                        #{r}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {refs.map((lineId) => {
                                  const evidence = data?.actionEvidence.find(log => log.line_id === lineId);
                                  if (!evidence) return null;
                                  return (
                                    <div key={lineId} className="ml-1 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1">
                                      <div className="text-[10px] text-slate-400 font-mono">
                                        {evidence.dataset_name} · Source line #{evidence.line_id} · {evidence.component} · {evidence.month} {evidence.date} {evidence.time}
                                      </div>
                                      <p className="text-xs text-slate-200 font-mono">{evidence.content}</p>
                                      <p className="text-[10px] text-slate-500">
                                        Referenced by this recorded investigation action.
                                      </p>
                                    </div>
                                  );
                                })}

                                <div className="text-[11px] text-slate-500 pt-1">
                                  Recorded by {act.analyst_name} ({['USR-SEC-01', 'USR-SEC-02'].includes(act.analyst_id) ? 'synthetic demo user' : 'user'})
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: Log Evidence */}
              {activeSubTab === 'evidence' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">Attached Log Evidence</h3>
                      <p className="text-xs text-slate-400">Original telemetry from LogHub Linux 2k dataset linked to this incident</p>
                    </div>
                    {!isReporter && (
                      <button
                        onClick={() => {
                          onClose();
                          onNavigateTab('logs');
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/60 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <Terminal className="w-3.5 h-3.5" />
                        <span>Search in Log Explorer</span>
                      </button>
                    )}
                  </div>

                  {data?.linkedLogs?.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl space-y-2">
                      <Terminal className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="text-xs text-slate-400">No log entries linked as evidence yet.</p>
                      <p className="text-[11px] text-slate-500">Go to Log Explorer to select and attach relevant log lines.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {data?.linkedLogs.map((log) => {
                        const lineNum = log.line_id || log.log_line_id;
                        return (
                          <div key={log.id || lineNum} className="p-3 bg-slate-900/80 border border-slate-800/80 rounded-xl space-y-1.5 font-mono text-xs">
                            <div className="flex items-center justify-between text-slate-400 text-[11px]">
                              <div className="flex items-center gap-2">
                                <span className="text-cyan-400 font-bold">Line #{lineNum}</span>
                                <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded">{log.component}</span>
                                {log.event_id && <span className="text-purple-400">[{log.event_id}]</span>}
                              </div>
                              <span>{log.month} {log.date} {log.time}</span>
                            </div>
                            <p className="text-slate-200 bg-slate-950/60 p-2 rounded border border-slate-900 select-all overflow-x-auto">
                              {log.content}
                            </p>
                            {log.reason && (
                              <p className="text-[11px] text-slate-400 font-sans">
                                Evidence Rationale: {log.reason} · Linked by {log.added_by}
                              </p>
                            )}
                            {log.dataset_name && (
                              <p className="text-[10px] text-slate-500 font-sans">Source dataset: {log.dataset_name}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Recommendations & Memory Synthesis */}
              {activeSubTab === 'recommendations' && (
                <div className="space-y-6">
                  {loadingRec ? (
                    <div className="py-16 text-center space-y-3">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400" />
                      <p className="text-xs text-slate-400">Analyzing incident symptoms against historical outcomes...</p>
                    </div>
                  ) : recommendation ? (
                    <div className="space-y-5">
                      {/* Active Mode Notice */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-cyan-400" />
                          <span className="font-semibold text-slate-200">Recommendation Engine</span>
                          <span className="text-slate-500">·</span>
                          <span className="font-mono text-cyan-300 uppercase">{recommendation.mode}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                          <span>Historical keyword similarity:</span>
                          <strong className="text-emerald-400 font-bold">
                            {recommendation.similarity_percentage === undefined
                              ? 'No matching incident'
                              : `${recommendation.similarity_percentage}%`}
                          </strong>
                        </div>
                        {recommendation.warning && (
                          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-900/60 text-xs text-amber-300">
                            {recommendation.warning}
                          </div>
                        )}
                      </div>

                      {/* Side-by-side or primary recommendation card */}
                      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-[#0e172a] border border-cyan-500/30 space-y-3 shadow-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                            Recommended Investigation Step
                          </span>
                          {recommendation.related_historical_incident_id && (
                            <span className="text-xs text-slate-400">
                              Based on: <strong className="text-cyan-300 font-mono">{recommendation.related_historical_incident_id}</strong>
                            </span>
                          )}
                        </div>
                        <h4 className="text-base font-semibold text-slate-100">
                          {recommendation.suggested_step}
                        </h4>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {recommendation.rationale}
                        </p>

                        <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 font-mono flex items-center gap-2">
                          <span>Supporting Evidence:</span>
                          <span className="text-slate-300 font-sans">{recommendation.supporting_evidence}</span>
                        </div>
                      </div>

                      {/* Cautionary Warnings for Failed Procedures */}
                      {recommendation.cautionary_failed_steps?.length > 0 && (
                        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/50 space-y-2">
                          <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs">
                            <XCircle className="w-4 h-4 text-rose-400" />
                            <span>CAUTIONARY LESSON: Previously Failed Actions Recorded in Memory</span>
                          </div>
                          <ul className="text-xs text-rose-200 space-y-1 list-disc pl-5">
                            {recommendation.cautionary_failed_steps.map((f: string, i: number) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Side-by-side Dual Comparison: Rule-Based vs AI-Assisted */}
                      {recommendation.side_by_side?.ai_assisted && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-mono uppercase text-slate-400">
                            Side-by-Side Verification Comparison
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                              <span className="text-[11px] font-mono text-cyan-400 font-semibold uppercase">Rule-Based Memory Retrieval</span>
                              <p className="font-medium text-slate-200">{recommendation.side_by_side.rule_based.step}</p>
                              <p className="text-slate-400">{recommendation.side_by_side.rule_based.rationale}</p>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-900 border border-cyan-900/60 space-y-2">
                              <span className="text-[11px] font-mono text-purple-400 font-semibold uppercase">AI-Assisted Synthesis (Gemini)</span>
                              <p className="font-medium text-slate-200">{recommendation.side_by_side.ai_assisted.step}</p>
                              <p className="text-slate-400">{recommendation.side_by_side.ai_assisted.rationale}</p>
                              <p className="text-[11px] text-purple-300/80 italic">{recommendation.side_by_side.ai_assisted.nuances}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {/* TAB 4: Collaboration & Updates */}
              {activeSubTab === 'collaboration' && (
                <div className="space-y-5">
                  <div className="space-y-3">
                    <h3 className="text-xs font-mono uppercase text-slate-400">Incident Updates & Discussion</h3>

                    {data?.comments?.length === 0 ? (
                      <p className="text-xs text-slate-500 py-6 text-center">No comments or notes yet.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {data?.comments.map((cmt) => (
                          <div
                            key={cmt.id}
                            className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                              cmt.is_confidential
                                ? 'bg-amber-950/20 border-amber-900/40 text-amber-200'
                                : 'bg-slate-900/70 border-slate-800 text-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-200">{cmt.author_name}</span>
                                <span className="text-slate-500">({cmt.author_role})</span>
                                {['USR-SEC-01', 'USR-SEC-02', 'USR-MGR-01', 'USR-REP-01'].includes(cmt.author_id) && (
                                  <span className="text-[10px] text-amber-300">Synthetic demo user</span>
                                )}
                                {cmt.is_confidential === 1 && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-mono">
                                    <Lock className="w-3 h-3" />
                                    <span>CONFIDENTIAL ANALYST NOTE</span>
                                  </span>
                                )}
                              </div>
                              <span className="font-mono">{cmt.created_at}</span>
                            </div>
                            <p className="leading-relaxed">{cmt.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add Comment Input Form */}
                  <form onSubmit={handlePostComment} className="space-y-2 pt-2 border-t border-slate-800">
                    <textarea
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder="Add an update, operational observation, or question..."
                      rows={3}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />

                    <div className="flex items-center justify-between">
                      {!isReporter && (
                        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isConfidential}
                            onChange={(e) => setIsConfidential(e.target.checked)}
                            className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                          />
                          <span>Internal Confidential Note (Hidden from Reporters)</span>
                        </label>
                      )}

                      <button
                        type="submit"
                        disabled={!commentInput.trim() || submittingComment}
                        className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 ml-auto"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{submittingComment ? 'Posting...' : 'Post Update'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 5: Audit Trail */}
              {activeSubTab === 'audit' && (
                <div className="space-y-3 font-mono text-xs">
                  <h3 className="text-xs uppercase text-slate-400 mb-2">Audit Trail (SQLite records; not tamper-proof)</h3>
                  <div className="space-y-2">
                    {data?.auditTrail?.map((aud) => (
                      <div key={aud.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-start justify-between gap-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-cyan-400 font-bold">{aud.action}</span>
                            <span className="text-slate-400 font-sans">by {aud.actor_name} ({aud.actor_role})</span>
                            {aud.is_synthetic_demo_user === 1 && (
                              <span className="text-amber-300 font-sans">Synthetic demo user</span>
                            )}
                            {aud.is_seeded_demo_data === 1 && (
                              <span className="text-amber-300 font-sans">Seeded demo data</span>
                            )}
                          </div>
                          <p className="text-slate-300 font-sans text-xs">{aud.details}</p>
                        </div>
                        <span className="text-[11px] text-slate-500 shrink-0">{aud.timestamp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
