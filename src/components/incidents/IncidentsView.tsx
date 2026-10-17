import React, { useState } from 'react';
import {
  Search,
  Filter,
  Plus,
  ArrowUpDown,
  Download,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import { Incident, IncidentAnalyticsFilter, Role, User } from '../../types';
import { StatusBadge, SeverityBadge } from '../common/Badge';
import { api } from '../../services/api';

interface IncidentsViewProps {
  incidents: Incident[];
  onSelectIncident: (id: string) => void;
  onOpenNewIncidentModal: () => void;
  userRole: Role;
  currentUser: User;
  users: User[];
  onRefresh: () => void;
  analyticsFilter: IncidentAnalyticsFilter | null;
  onClearAnalyticsFilter: () => void;
}

export const IncidentsView: React.FC<IncidentsViewProps> = ({
  incidents,
  onSelectIncident,
  onOpenNewIncidentModal,
  userRole,
  currentUser,
  users,
  onRefresh,
  analyticsFilter,
  onClearAnalyticsFilter
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [systemFilter, setSystemFilter] = useState('all');
  const [ownershipFilter, setOwnershipFilter] = useState('all');
  const [assignmentIncident, setAssignmentIncident] = useState<Incident | null>(null);
  const [targetAnalystId, setTargetAnalystId] = useState(users.find(u => u.role === 'analyst')?.id || '');
  const [assignmentReason, setAssignmentReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const analysts = users.filter(user => user.role === 'analyst');

  const systems = Array.from(new Set(incidents.map(i => i.affected_system)));

  const filtered = incidents.filter(inc => {
    if (statusFilter !== 'all' && inc.status !== statusFilter) return false;
    if (severityFilter !== 'all' && inc.severity !== severityFilter) return false;
    if (systemFilter !== 'all' && inc.affected_system !== systemFilter) return false;
    if (ownershipFilter === 'mine' && inc.assigned_analyst_id !== currentUser.id) return false;
    if (ownershipFilter === 'unassigned' && inc.assigned_analyst_id !== null) return false;
    if (ownershipFilter === 'others' && (!inc.assigned_analyst_id || inc.assigned_analyst_id === currentUser.id)) return false;
    if (ownershipFilter === 'critical-high' && inc.severity !== 'Critical' && inc.severity !== 'High') return false;
    if (analyticsFilter?.statuses && !analyticsFilter.statuses.includes(inc.status)) return false;
    if (analyticsFilter?.analystId && inc.assigned_analyst_id !== analyticsFilter.analystId) return false;
    if (analyticsFilter?.unassigned && inc.assigned_analyst_id !== null) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchId = inc.id.toLowerCase().includes(q);
      const matchTitle = inc.title.toLowerCase().includes(q);
      const matchDesc = inc.description.toLowerCase().includes(q);
      const matchSys = inc.affected_system.toLowerCase().includes(q);
      return matchId || matchTitle || matchDesc || matchSys;
    }
    return true;
  });

  const claimIncident = async (id: string) => {
    setActionError(null);
    try {
      await api.claimIncident(id, currentUser.id);
      onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to claim incident.');
      onRefresh();
    }
  };

  const submitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentIncident || !targetAnalystId) return;
    const selectedAnalyst = analysts.find(analyst => analyst.id === targetAnalystId);
    if (assignmentIncident.assigned_analyst_id && assignmentIncident.assigned_analyst_id !== targetAnalystId) {
      if (!window.confirm(`Reassign ${assignmentIncident.id} from ${assignmentIncident.assigned_analyst_name} to ${selectedAnalyst?.name}?`)) return;
    }
    setActionError(null);
    try {
      await api.assignIncident(assignmentIncident.id, {
        assigned_analyst_id: targetAnalystId,
        user_id: currentUser.id,
        reason: assignmentReason
      });
      setAssignmentIncident(null);
      setAssignmentReason('');
      onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to assign incident.');
    }
  };

  const exportCsv = () => {
    const headers = ['Incident ID', 'Title', 'System', 'Severity', 'Status', 'Reporter', 'Analyst', 'Resolution Summary', 'Created At'];
    const rows = filtered.map(i => [
      `"${i.id}"`,
      `"${i.title.replace(/"/g, '""')}"`,
      `"${i.affected_system}"`,
      `"${i.severity}"`,
      `"${i.status}"`,
      `"${i.reporter_name}"`,
      `"${i.assigned_analyst_name || 'Unassigned'}"`,
      `"${(i.resolution_summary || '').replace(/"/g, '""')}"`,
      `"${i.created_at}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `incidentiq_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            Incident Register & Management
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tracked incidents across IBM Z and LinuxONE partitions with associated log evidence and recorded outcomes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={exportCsv}
            className="px-3 py-1.5 text-xs text-slate-300 hover:text-slate-100 bg-slate-900 border border-slate-700/80 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenNewIncidentModal}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-cyan-950/40"
          >
            <Plus className="w-4 h-4" />
            <span>Register Incident</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#0f172a] border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by ID, keyword, symptom, or partition name..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={ownershipFilter}
            onChange={(e) => setOwnershipFilter(e.target.value)}
            aria-label="Filter by assignment"
            className="bg-slate-900 border border-slate-700/80 text-slate-300 text-xs rounded-xl px-3 py-2"
          >
            <option value="all">All Incidents</option>
            <option value="mine">My Incidents</option>
            <option value="unassigned">Unassigned Incidents</option>
            <option value="others">Assigned to Others</option>
            <option value="critical-high">Critical &amp; High</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="bg-slate-900 border border-slate-700/80 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Unresolved">Unresolved</option>
            <option value="Escalation Requested">Escalation Requested</option>
            <option value="Escalated">Escalated</option>
            <option value="Resolved">Resolved</option>
            <option value="Reopened">Reopened</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            aria-label="Filter by severity"
            className="bg-slate-900 border border-slate-700/80 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
          >
            <option value="all">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            value={systemFilter}
            onChange={(e) => setSystemFilter(e.target.value)}
            aria-label="Filter by partition system"
            className="bg-slate-900 border border-slate-700/80 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer max-w-[180px] truncate"
          >
            <option value="all">All Partitions</option>
            {systems.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {(statusFilter !== 'all' || severityFilter !== 'all' || systemFilter !== 'all' || ownershipFilter !== 'all' || searchTerm || analyticsFilter) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setSeverityFilter('all');
                setSystemFilter('all');
                setOwnershipFilter('all');
                setSearchTerm('');
                onClearAnalyticsFilter();
              }}
              className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>
      {actionError && (
        <div role="alert" className="rounded-xl border border-rose-800 bg-rose-950/40 px-4 py-3 text-xs text-rose-200">
          {actionError}
        </div>
      )}

      {/* Table */}
      <div className="bg-[#0f172a] border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/40 text-slate-400 font-mono text-[11px] uppercase">
                <th className="py-3 px-4 font-semibold">Incident ID</th>
                <th className="py-3 px-4 font-semibold">Title & Description</th>
                <th className="py-3 px-4 font-semibold">Affected System</th>
                <th className="py-3 px-4 font-semibold">Severity</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Ownership & Assignment</th>
                <th className="py-3 px-4 font-semibold">Outcome Memory</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    No incidents match your current search and filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((inc) => (
                  <tr
                    key={inc.id}
                    onClick={() => onSelectIncident(inc.id)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-cyan-400">
                      {inc.id}
                    </td>
                    <td className="py-3.5 px-4 max-w-sm">
                      <p className="font-semibold text-slate-200 truncate group-hover:text-cyan-300 transition-colors">
                        {inc.title}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {inc.description}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {inc.affected_system}
                    </td>
                    <td className="py-3.5 px-4">
                      <SeverityBadge severity={inc.severity} />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={inc.status} />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-200 font-medium">{inc.assigned_analyst_name || 'Unassigned'}</div>
                      <div className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] ${
                        !inc.assigned_analyst_id ? 'bg-slate-800 text-slate-300' :
                        inc.assigned_analyst_id === currentUser.id ? 'bg-emerald-950 text-emerald-300' :
                        'bg-amber-950 text-amber-300'
                      }`}>
                        {!inc.assigned_analyst_id ? 'Unassigned' :
                          inc.assigned_analyst_id === currentUser.id ? 'Assigned to me' : 'Assigned to another analyst'}
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">
                        Assigned: {inc.assignment_timestamp || 'Timestamp unavailable'}
                      </div>
                      {userRole === 'analyst' && !inc.assigned_analyst_id && (
                        <button
                          onClick={(e) => { e.stopPropagation(); claimIncident(inc.id); }}
                          className="mt-2 rounded-md border border-cyan-800 px-2 py-1 text-[10px] text-cyan-300 hover:bg-cyan-950/50"
                        >
                          Claim Incident
                        </button>
                      )}
                      {userRole === 'manager' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setAssignmentIncident(inc); }}
                          className="mt-2 rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-800"
                        >
                          {inc.assigned_analyst_id ? 'Reassign' : 'Assign Analyst'}
                        </button>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {inc.resolution_verified === 'Verified' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                          <Check className="w-3.5 h-3.5" />
                          <span>Verified ({inc.resolution_time_minutes}m)</span>
                        </span>
                      ) : inc.status === 'Resolved' ? (
                        <span className="text-[11px] text-slate-400">Unverified Procedure</span>
                      ) : (
                        <span className="text-[11px] text-slate-500">Investigation Active</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectIncident(inc.id);
                        }}
                        disabled={userRole === 'analyst' && inc.assigned_analyst_id !== currentUser.id}
                        title={userRole === 'analyst' && inc.assigned_analyst_id && inc.assigned_analyst_id !== currentUser.id
                          ? `Owned by ${inc.assigned_analyst_name}; ask a manager to reassign it.`
                          : userRole === 'analyst' && !inc.assigned_analyst_id ? 'Claim the incident before investigating.' : 'Open investigation'}
                        className="px-2.5 py-1 text-xs text-slate-300 hover:text-cyan-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 rounded transition-colors font-medium"
                      >
                        {userRole === 'reporter' ? 'Details' : 'Investigate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {assignmentIncident && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
            <form onSubmit={submitAssignment} className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-[#0f172a] p-5 shadow-2xl">
              <div>
                <h3 className="text-sm font-bold text-slate-100">
                  {assignmentIncident.assigned_analyst_id ? 'Reassign' : 'Assign'} {assignmentIncident.id}
                </h3>
                <p className="mt-1 text-xs text-slate-400">{assignmentIncident.title}</p>
              </div>
              <label className="block text-xs text-slate-300">
                Analyst
                <select
                  value={targetAnalystId}
                  onChange={e => setTargetAnalystId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200"
                >
                  {analysts.map(analyst => <option key={analyst.id} value={analyst.id}>{analyst.name}</option>)}
                </select>
              </label>
              <label className="block text-xs text-slate-300">
                Reason (optional)
                <input
                  value={assignmentReason}
                  onChange={e => setAssignmentReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setAssignmentIncident(null)} className="rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-slate-800">Cancel</button>
                <button type="submit" className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950">Save assignment</button>
              </div>
            </form>
          </div>
        )}

        {/* Footer status count */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/30 text-xs text-slate-400 flex items-center justify-between">
          <span>Showing <strong className="text-slate-200">{filtered.length}</strong> of <strong className="text-slate-200">{incidents.length}</strong> incidents</span>
          <span className="font-mono text-[11px]">IBM Z System Telemetry Database</span>
        </div>
      </div>
    </div>
  );
};
