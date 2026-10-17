import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Database,
  Search,
  Filter,
  Check,
  ChevronRight
} from 'lucide-react';
import { AnalyticsOverview, Incident, Role } from '../../types';
import { StatusBadge, SeverityBadge } from '../common/Badge';

interface OverviewViewProps {
  analytics: AnalyticsOverview | null;
  recentIncidents: Incident[];
  onSelectIncident: (id: string) => void;
  onNavigateTab: (tab: string) => void;
  userRole: Role;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  analytics,
  recentIncidents,
  onSelectIncident,
  onNavigateTab,
  userRole
}) => {
  const [systemFilter, setSystemFilter] = useState('all');
  const metrics = analytics?.metrics;
  const charts = analytics?.charts;

  const filteredIncidents = systemFilter === 'all'
    ? recentIncidents
    : recentIncidents.filter(i => i.affected_system === systemFilter);

  // Distinct systems list
  const systems = Array.from(new Set(recentIncidents.map(i => i.affected_system)));

  return (
    <div className="space-y-6">
      {/* Top Banner Notice: Outcome-Aware Incident Memory */}
      <div className="bg-gradient-to-r from-slate-900/90 via-[#0d162d] to-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold text-cyan-400 uppercase tracking-wider">IBM Z Incident Memory Platform</span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-400">Team Zenvora</span>
          </div>
          <h2 className="text-lg font-bold text-slate-100">
            Learn from every incident. Resolve the next one smarter.
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            IncidentIQ connects system log evidence from LinuxONE LPARs to past investigation actions, tracking which diagnostic procedures succeeded and which failed to build reusable enterprise memory.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => onNavigateTab('similarity')}
            className="px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5 text-cyan-400" />
            <span>Search Memory</span>
          </button>
          <button
            onClick={() => onNavigateTab('workflow')}
            className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <span>Explore 3D Lifecycle</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Cards Row - Real Persisted Database Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Incidents */}
        <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Total Incidents</span>
            <Database className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
            {metrics?.total_incidents ?? 0}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
            <span className="text-cyan-400">{metrics?.open_incidents ?? 0} open</span>
            <span>·</span>
            <span>{metrics?.in_progress_incidents ?? 0} active</span>
          </div>
        </div>

        {/* Critical & High */}
        <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Critical / High</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-300 tabular-nums">
            {(metrics?.critical_incidents ?? 0) + (metrics?.high_incidents ?? 0)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {metrics?.critical_incidents ?? 0} critical priority
          </div>
        </div>

        {/* Resolved with Verified Outcome */}
        <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-300 tabular-nums">
            {metrics?.resolved_incidents ?? 0}
          </div>
          <div className="mt-1 text-[11px] text-emerald-400/90 flex items-center gap-1">
            <Check className="w-3 h-3" />
            <span>{metrics?.verified_resolutions ?? 0} verified memory</span>
          </div>
        </div>

        {/* Pending Escalations */}
        <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Escalation Queue</span>
            <ArrowUpRight className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-300 tabular-nums">
            {metrics?.pending_escalation_reviews ?? 0}
          </div>
          <div className="mt-1 text-[11px] text-amber-400/80">
            Awaiting Manager Review
          </div>
        </div>

        {/* Investigation Actions Recorded */}
        <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Outcome Actions</span>
            <AlertTriangle className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
            {(metrics?.successful_actions ?? 0) + (metrics?.failed_actions ?? 0)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="text-emerald-400">{metrics?.successful_actions ?? 0} passed</span>
            <span>/</span>
            <span className="text-rose-400">{metrics?.failed_actions ?? 0} failed</span>
          </div>
        </div>

        {/* Avg Resolution Time */}
        <div className="bg-[#0f172a] border border-slate-800/80 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Avg Resolution</span>
            <Clock className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
            {metrics?.avg_resolution_time_minutes ?? 0}<span className="text-xs text-slate-400 font-sans ml-1">min</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Calculated from database
          </div>
        </div>
      </div>

      {/* Main Charts & Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Severity Distribution Donut / Bar */}
        <div className="bg-[#0f172a] border border-slate-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-100">Incident Severity Distribution</h3>
            <span className="text-[11px] font-mono text-slate-400">Persisted Records</span>
          </div>

          <div className="space-y-3">
            {charts?.severity_distribution?.map((item) => {
              const total = metrics?.total_incidents || 1;
              const pct = Math.round((item.count / total) * 100);
              let barColor = 'bg-slate-500';
              if (item.severity === 'Critical') barColor = 'bg-rose-500';
              if (item.severity === 'High') barColor = 'bg-amber-500';
              if (item.severity === 'Medium') barColor = 'bg-sky-500';
              if (item.severity === 'Low') barColor = 'bg-slate-400';

              return (
                <div key={item.severity} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">{item.severity}</span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {item.count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Most Common Log Components from Dataset */}
        <div className="bg-[#0f172a] border border-slate-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Log Component Telemetry</h3>
              <p className="text-[11px] text-slate-400">LogHub Public Linux benchmark dataset</p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/60">
              2,000 Lines
            </span>
          </div>

          <div className="space-y-2.5">
            {charts?.log_components?.map((comp) => {
              const maxCount = charts.log_components[0]?.count || 1;
              const barWidth = Math.round((comp.count / maxCount) * 100);

              return (
                <div key={comp.component} className="text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-slate-300 font-medium truncate max-w-[170px]">
                      {comp.component}
                    </span>
                    <span className="font-mono text-slate-400 tabular-nums">
                      {comp.count} events
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* System Distribution & Outcomes */}
        <div className="bg-[#0f172a] border border-slate-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-100">Affected IBM Z Partitions</h3>
            <span className="text-[11px] font-mono text-slate-400">LPAR Topology</span>
          </div>

          <div className="space-y-3">
            {charts?.system_distribution?.map((sys) => {
              return (
                <div key={sys.affected_system} className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="truncate mr-2">
                    <p className="font-medium text-slate-200 truncate">{sys.affected_system}</p>
                    <p className="text-[11px] text-slate-500 font-mono">Linux on zSystems</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-cyan-300 tabular-nums">{sys.count}</span>
                    <span className="text-[10px] text-slate-500 ml-1">incidents</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Incidents Table */}
      <div className="bg-[#0f172a] border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
        {/* Table Toolbar */}
        <div className="p-5 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-100">Tracked Incidents</h3>
            <p className="text-xs text-slate-400">Chronological incident investigation records with persistent memory state</p>
          </div>

          <div className="flex items-center gap-3">
            {/* System Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Filter className="w-3.5 h-3.5" />
              <select
                value={systemFilter}
                onChange={(e) => setSystemFilter(e.target.value)}
                aria-label="Filter incidents by partition"
                className="bg-slate-900 border border-slate-700/80 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
              >
                <option value="all">All Partitions</option>
                {systems.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => onNavigateTab('incidents')}
              className="px-3 py-1.5 text-xs font-medium text-cyan-300 hover:text-cyan-200 hover:bg-cyan-950/30 rounded-lg transition-colors flex items-center gap-1"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/40 text-slate-400 font-mono text-[11px] uppercase">
                <th className="py-3 px-4 font-semibold">Incident ID</th>
                <th className="py-3 px-4 font-semibold">Title & Symptoms</th>
                <th className="py-3 px-4 font-semibold">Affected System</th>
                <th className="py-3 px-4 font-semibold">Severity</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Assigned Analyst</th>
                <th className="py-3 px-4 font-semibold">Resolution Memory</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No incidents match the active partition filter.
                  </td>
                </tr>
              ) : (
                filteredIncidents.slice(0, 8).map((inc) => (
                  <tr
                    key={inc.id}
                    onClick={() => onSelectIncident(inc.id)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-cyan-400">
                      {inc.id}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="font-medium text-slate-200 truncate group-hover:text-cyan-300 transition-colors">
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
                    <td className="py-3.5 px-4 text-slate-300 font-medium">
                      {inc.assigned_analyst_name || <span className="text-slate-500 italic">Unassigned</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      {inc.resolution_verified === 'Verified' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                          <Check className="w-3.5 h-3.5" />
                          <span>Verified Procedure</span>
                        </span>
                      ) : inc.status === 'Resolved' ? (
                        <span className="text-[11px] text-slate-400">Unverified Claim</span>
                      ) : (
                        <span className="text-[11px] text-slate-600">Pending Outcome</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectIncident(inc.id);
                        }}
                        className="px-2.5 py-1 text-xs text-slate-300 hover:text-cyan-300 hover:bg-slate-800 rounded transition-colors font-medium"
                      >
                        Investigate
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
