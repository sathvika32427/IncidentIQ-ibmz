import React, { useState, useEffect } from 'react';
import {
  ArrowUpRight,
  ShieldCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  RefreshCw,
  User,
  ShieldAlert
} from 'lucide-react';
import { EscalationRequest, Role, User as UserType } from '../../types';
import { SeverityBadge } from '../common/Badge';
import { api } from '../../services/api';

interface EscalationQueueViewProps {
  currentUser: UserType;
  onOpenReviewModal: (escalationId: string, incidentId: string) => void;
  onSelectIncident: (id: string) => void;
}

export const EscalationQueueView: React.FC<EscalationQueueViewProps> = ({
  currentUser,
  onOpenReviewModal,
  onSelectIncident
}) => {
  const [escalations, setEscalations] = useState<EscalationRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<'Pending' | 'Approved' | 'Returned' | 'Rejected' | 'all'>('Pending');
  const [loading, setLoading] = useState(false);

  const isManager = currentUser.role === 'manager';

  const fetchEscalations = async () => {
    try {
      setLoading(true);
      const res = await api.getEscalations(statusFilter);
      setEscalations(res.escalations);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEscalations();
  }, [statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            Human Escalation Queue
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Enterprise managerial governance queue: Human review of elevated incidents, cross-partition blockers, and specialized permission requests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isManager && (
            <div className="px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-[11px] text-amber-300 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Read-Only: Manager Decision Authority Required</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit text-xs font-medium">
        <button
          onClick={() => setStatusFilter('Pending')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            statusFilter === 'Pending'
              ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Pending Review
        </button>
        <button
          onClick={() => setStatusFilter('Approved')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            statusFilter === 'Approved'
              ? 'bg-purple-400 text-slate-950 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Approved Escalations
        </button>
        <button
          onClick={() => setStatusFilter('Returned')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            statusFilter === 'Returned'
              ? 'bg-slate-700 text-slate-100 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Returned for Evidence
        </button>
        <button
          onClick={() => setStatusFilter('Rejected')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            statusFilter === 'Rejected'
              ? 'bg-rose-500 text-white font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Rejected
        </button>
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            statusFilter === 'all'
              ? 'bg-cyan-400 text-slate-950 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All Requests
        </button>
      </div>

      {/* Queue Content */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400 mb-2" />
            <p className="text-xs">Loading escalation records...</p>
          </div>
        ) : escalations.length === 0 ? (
          <div className="p-12 text-center bg-[#0f172a] border border-dashed border-slate-800 rounded-2xl space-y-2">
            <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">
              No escalations currently in this state.
            </h3>
            <p className="text-xs text-slate-500">
              When an analyst requests technical escalation, it will appear here for manager evaluation.
            </p>
          </div>
        ) : (
          escalations.map((esc) => {
            let badgeBg = 'bg-slate-800 text-slate-300';
            if (esc.status === 'Pending') badgeBg = 'bg-amber-950/60 text-amber-300 border-amber-800/80';
            if (esc.status === 'Approved') badgeBg = 'bg-purple-950/60 text-purple-300 border-purple-800/80';
            if (esc.status === 'Returned') badgeBg = 'bg-sky-950/60 text-sky-300 border-sky-800/80';
            if (esc.status === 'Rejected') badgeBg = 'bg-rose-950/60 text-rose-300 border-rose-800/80';

            return (
              <div
                key={esc.id}
                className="bg-[#0f172a] border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-sm hover:border-slate-700 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-cyan-400 font-bold text-xs">{esc.incident_id}</span>
                      {esc.severity && <SeverityBadge severity={esc.severity} />}
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${badgeBg}`}>
                        {esc.status}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">{esc.requested_at}</span>
                    </div>
                    <h3 className="text-base font-semibold text-slate-100">{esc.title}</h3>
                    <p className="text-xs text-slate-400">Partition: {esc.affected_system}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectIncident(esc.incident_id)}
                      className="px-3 py-1.5 text-xs text-slate-300 hover:text-slate-100 bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      View Incident
                    </button>

                    {isManager && esc.status === 'Pending' && (
                      <button
                        onClick={() => onOpenReviewModal(esc.id, esc.incident_id)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Review & Decide</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Technical Reason */}
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-1">
                  <div className="text-[11px] font-mono uppercase text-slate-400">
                    Analyst Escalation Justification ({esc.requested_by_name}):
                  </div>
                  <p className="text-slate-200 font-medium">{esc.reason}</p>
                  {esc.supporting_details && (
                    <p className="text-slate-400 text-[11px] pt-1">{esc.supporting_details}</p>
                  )}
                </div>

                {/* Manager Decision Record if already reviewed */}
                {esc.reviewed_by_name && (
                  <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-900/50 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono text-purple-300">
                      <span>DECISION: {esc.status.toUpperCase()} by {esc.reviewed_by_name}</span>
                      <span>{esc.reviewed_at}</span>
                    </div>
                    <p className="text-slate-300">{esc.review_notes}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
