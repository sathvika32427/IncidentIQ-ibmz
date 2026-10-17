import React, { useState } from 'react';
import { Users, Shield, CheckCircle2, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { Incident, User } from '../../types';
import { StatusBadge, SeverityBadge } from '../common/Badge';
import { api } from '../../services/api';

interface TeamViewProps {
  incidents: Incident[];
  users: User[];
  onSelectIncident: (id: string) => void;
  onRefresh: () => void;
  currentUser: User;
}

export const TeamView: React.FC<TeamViewProps> = ({
  incidents,
  users,
  onSelectIncident,
  onRefresh,
  currentUser
}) => {
  const [selectedIncidentForReassign, setSelectedIncidentForReassign] = useState<Incident | null>(null);
  const [targetAnalystId, setTargetAnalystId] = useState('USR-SEC-01');
  const [assignmentReason, setAssignmentReason] = useState('');
  const [reassigning, setReassigning] = useState(false);

  const analysts = users.filter(u => u.role === 'analyst');
  const isManager = currentUser.role === 'manager';

  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncidentForReassign) return;
    if (selectedIncidentForReassign.assigned_analyst_id && !window.confirm(
      `Reassign ${selectedIncidentForReassign.id} from ${selectedIncidentForReassign.assigned_analyst_name} to ${analysts.find(a => a.id === targetAnalystId)?.name}?`
    )) return;

    try {
      setReassigning(true);
      await api.assignIncident(selectedIncidentForReassign.id, {
        assigned_analyst_id: targetAnalystId,
        user_id: currentUser.id,
        reason: assignmentReason
      });
      setSelectedIncidentForReassign(null);
      setAssignmentReason('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to reassign incident');
    } finally {
      setReassigning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100 tracking-tight">
          Team Workload & Assignment Distribution
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Monitor analyst active queues, resolved investigations, and reassign ownership across IBM Z response specialists.
        </p>
      </div>

      {/* Analyst Workload Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {analysts.map((analyst) => {
          const assignedIncidents = incidents.filter(i => i.assigned_analyst_id === analyst.id);
          const activeCount = assignedIncidents.filter(i => i.status !== 'Resolved').length;
          const resolvedCount = assignedIncidents.filter(i => i.status === 'Resolved').length;
          const criticalCount = assignedIncidents.filter(i => i.severity === 'Critical' && i.status !== 'Resolved').length;

          return (
            <div
              key={analyst.id}
              className="bg-[#0f172a] border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-sm"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-800/80 text-cyan-300 font-bold font-mono flex items-center justify-center">
                    {analyst.avatar}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{analyst.name}</h3>
                    {analyst.is_demo_user === 1 && (
                      <span className="text-[10px] text-amber-300 font-mono">Synthetic demo user</span>
                    )}
                    <p className="text-[11px] text-slate-400 font-mono">{analyst.email}</p>
                  </div>
                </div>

                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {analyst.id}
                </span>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono uppercase block">Active Queue</span>
                  <span className="text-lg font-bold font-mono text-cyan-300 tabular-nums">{activeCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono uppercase block">Resolved Fixes</span>
                  <span className="text-lg font-bold font-mono text-emerald-400 tabular-nums">{resolvedCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono uppercase block">Critical Blockers</span>
                  <span className={`text-lg font-bold font-mono tabular-nums ${criticalCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                    {criticalCount}
                  </span>
                </div>
              </div>

              {/* Assigned Incidents snippet */}
              <div className="space-y-2 pt-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">Assigned Incidents</span>
                {assignedIncidents.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">No active assignments</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {assignedIncidents.map(inc => (
                      <div
                        key={inc.id}
                        className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between text-xs hover:border-slate-700 transition-colors"
                      >
                        <div className="truncate mr-2">
                          <span className="font-mono text-cyan-400 font-bold">{inc.id}</span>: {inc.title}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <SeverityBadge severity={inc.severity} />
                          <StatusBadge status={inc.status} />
                          {isManager && (
                            <button
                              onClick={() => setSelectedIncidentForReassign(inc)}
                              className="px-2 py-0.5 text-[11px] text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
                            >
                              Reassign
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reassign Modal */}
      {selectedIncidentForReassign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-100">
              Reassign Incident {selectedIncidentForReassign.id}
            </h3>
            <p className="text-xs text-slate-400">
              {selectedIncidentForReassign.title}
            </p>

            <form onSubmit={handleReassign} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Target Analyst *</label>
                <select
                  value={targetAnalystId}
                  onChange={(e) => setTargetAnalystId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                >
                  {analysts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">Reason (optional)</label>
                <input
                  value={assignmentReason}
                  onChange={(e) => setAssignmentReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                  placeholder="Add context for the assignment history"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedIncidentForReassign(null)}
                  className="px-3.5 py-1.5 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reassigning}
                  className="px-4 py-1.5 font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl disabled:opacity-50"
                >
                  {reassigning ? 'Reassigning...' : 'Confirm Reassignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
