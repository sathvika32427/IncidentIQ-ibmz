import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { AnalyticsOverview, Incident, IncidentAnalyticsFilter } from '../../types';

interface AnalyticsViewProps {
  analytics: AnalyticsOverview | null;
  incidents: Incident[];
  error?: string | null;
  onFilterIncidents: (filter: IncidentAnalyticsFilter) => void;
}

const COLORS = ['#22d3ee', '#818cf8', '#f59e0b', '#34d399', '#fb7185', '#a78bfa'];
const panelClass = 'rounded-2xl border border-slate-800/80 bg-[#0f172a] p-5';

function Panel({ title, subtitle, children }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`${panelClass} space-y-4`}>
      <div>
        <h3 className="text-sm font-bold text-slate-100">{title}</h3>
        {subtitle && <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function EmptyChart({ message = 'No recorded data for this period.' }: { message?: string }) {
  return <div className="flex min-h-36 items-center justify-center rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">{message}</div>;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ analytics, incidents, error, onFilterIncidents }) => {
  const [trendPeriod, setTrendPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const metrics = analytics?.metrics;
  const charts = analytics?.charts;

  const statusSlices = useMemo(() => {
    const counts = new Map((charts?.status_distribution || []).map(row => [row.status, row.count]));
    return [
      { label: 'Open', count: (counts.get('Open') || 0) + (counts.get('Reopened') || 0), color: COLORS[0], statuses: ['Open', 'Reopened'] as const },
      { label: 'In progress', count: (counts.get('In Progress') || 0) + (counts.get('Unresolved') || 0), color: COLORS[1], statuses: ['In Progress', 'Unresolved'] as const },
      { label: 'Escalation workflow', count: (counts.get('Escalation Requested') || 0) + (counts.get('Escalated') || 0), color: COLORS[2], statuses: ['Escalation Requested', 'Escalated'] as const },
      { label: 'Resolved', count: counts.get('Resolved') || 0, color: COLORS[3], statuses: ['Resolved'] as const }
    ];
  }, [charts?.status_distribution]);

  const trends = useMemo(() => {
    const byPeriod = new Map<string, { opened: number; resolved: number }>();
    (charts?.incident_trends || []).forEach(row => {
      const date = new Date(`${row.day}T00:00:00Z`);
      let key = row.day;
      if (trendPeriod === 'weekly') {
        date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
        key = date.toISOString().slice(0, 10);
      } else if (trendPeriod === 'monthly') {
        key = row.day.slice(0, 7);
      }
      const current = byPeriod.get(key) || { opened: 0, resolved: 0 };
      current.opened += row.opened;
      current.resolved += row.resolved;
      byPeriod.set(key, current);
    });
    return [...byPeriod.entries()].map(([period, values]) => ({ period, ...values }));
  }, [charts?.incident_trends, trendPeriod]);

  const exportReport = (format: 'csv' | 'json') => {
    if (format === 'json') {
      const data = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ metrics, charts, incidents }, null, 2))}`;
      const link = document.createElement('a');
      link.href = data;
      link.download = `incidentiq_analytics_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const headers = ['Incident ID', 'Title', 'Partition', 'Severity', 'Status', 'Resolution Time (min)', 'Verified'];
    const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = incidents.map(incident => [
      incident.id,
      incident.title,
      incident.affected_system,
      incident.severity,
      incident.status,
      incident.resolution_time_minutes,
      incident.resolution_verified
    ].map(quote).join(','));
    const data = `data:text/csv;charset=utf-8,${encodeURIComponent([headers.join(','), ...rows].join('\r\n'))}`;
    const link = document.createElement('a');
    link.href = data;
    link.download = `incidentiq_analytics_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (error) {
    return <div role="alert" className="rounded-xl border border-rose-800 bg-rose-950/40 p-4 text-sm text-rose-200">Analytics could not be loaded: {error}</div>;
  }
  if (!analytics || !metrics || !charts) {
    return <div role="status" className="rounded-xl border border-slate-800 bg-[#0f172a] p-6 text-sm text-slate-400">Loading analytics from SQLite…</div>;
  }

  const total = metrics?.total_incidents || 0;
  const actionCounts = ['Successful', 'Failed', 'In Progress', 'Inconclusive'].map((result, index) => ({
    result,
    count: charts?.action_distribution?.find(row => row.result === result)?.count || 0,
    color: COLORS[index]
  }));
  const escalationCounts = ['Pending', 'Approved', 'Rejected', 'Returned'].map((status, index) => ({
    status,
    count: charts?.escalation_distribution?.find(row => row.status === status)?.count || 0,
    color: COLORS[index]
  }));
  const severityCounts = ['Critical', 'High', 'Medium', 'Low'].map((severity, index) => ({
    severity,
    count: charts?.severity_distribution?.find(row => row.severity === severity)?.count || 0,
    color: ['#fb7185', '#f97316', '#fbbf24', '#34d399'][index]
  }));
  const maxTrend = Math.max(1, ...trends.flatMap(row => [row.opened, row.resolved]));
  const trendPoints = (key: 'opened' | 'resolved') => trends.map((row, index) => {
    const x = trends.length < 2 ? 360 : 36 + (index / (trends.length - 1)) * 648;
    const y = 190 - (row[key] / maxTrend) * 160;
    return `${x},${y}`;
  }).join(' ');
  const successRate = metrics.resolution_success_rate;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100">Manager Analytics &amp; Operational Reports</h2>
          <p className="mt-1 text-xs text-slate-400">Metrics and visualizations are calculated from saved incident, action, and escalation records in SQLite.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportReport('csv')} className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">
            <Download className="h-3.5 w-3.5" /> Export CSV Report
          </button>
          <button onClick={() => exportReport('json')} className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">
            <Download className="h-3.5 w-3.5" /> Export JSON
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[
          { label: 'Total tracked incidents', value: total, note: 'Across all partitions', color: 'text-slate-100' },
          { label: 'Active incidents', value: metrics.active_incidents, note: 'All statuses except resolved', color: 'text-cyan-300' },
          { label: 'Confirmed resolution success', value: successRate === null ? '—' : `${successRate}%`, note: `${metrics.verified_resolutions} verified of ${metrics.resolution_attempts} recorded attempts`, color: 'text-emerald-300' },
          { label: 'Mean time to resolution', value: metrics.avg_resolution_time_minutes ? `${metrics.avg_resolution_time_minutes} min` : '—', note: 'Mean of verified resolutions with a recorded duration', color: 'text-indigo-300' },
          { label: 'Pending escalations', value: metrics.pending_escalation_reviews, note: 'Awaiting manager review', color: 'text-amber-300' },
          { label: 'Unassigned incidents', value: metrics.unassigned_incidents, note: 'No analyst owner recorded', color: 'text-rose-300' }
        ].map(card => (
          <div key={card.label} className={`${panelClass} space-y-1`}>
            <span className="text-xs text-slate-400">{card.label}</span>
            <div className={`font-mono text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</div>
            <p className="text-[11px] text-slate-500">{card.note}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Incident status" subtitle="Open includes reopened; in progress includes unresolved; escalation workflow includes requested and approved escalations.">
          {total === 0 ? <EmptyChart /> : (
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              <svg viewBox="0 0 120 120" className="h-40 w-40 shrink-0" role="img" aria-label="Incident status donut chart">
                <circle cx="60" cy="60" r="43" fill="none" stroke="#1e293b" strokeWidth="14" />
                {statusSlices.reduce<{ offset: number; nodes: React.ReactNode[] }>((acc, slice) => {
                  const length = (slice.count / total) * 270.18;
                  acc.nodes.push(
                    <circle
                      key={slice.label}
                      cx="60" cy="60" r="43" fill="none" stroke={slice.color} strokeWidth="14"
                      strokeDasharray={`${length} ${270.18 - length}`}
                      strokeDashoffset={-acc.offset}
                      transform="rotate(-90 60 60)"
                      className="cursor-pointer"
                      onClick={() => onFilterIncidents({ statuses: [...slice.statuses] })}
                    >
                      <title>{`${slice.label}: ${slice.count} (${Math.round(slice.count / total * 100)}%)`}</title>
                    </circle>
                  );
                  acc.offset += length;
                  return acc;
                }, { offset: 0, nodes: [] }).nodes}
                <text x="60" y="57" textAnchor="middle" fill="#f1f5f9" fontSize="17" fontWeight="700">{total}</text>
                <text x="60" y="71" textAnchor="middle" fill="#94a3b8" fontSize="7">INCIDENTS</text>
              </svg>
              <div className="w-full space-y-3">
                {statusSlices.map(slice => (
                  <button key={slice.label} onClick={() => onFilterIncidents({ statuses: [...slice.statuses] })} className="flex w-full items-center justify-between gap-3 text-left text-xs hover:text-cyan-200">
                    <span className="flex items-center gap-2 text-slate-300"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: slice.color }} />{slice.label}</span>
                    <span className="font-mono text-slate-300">{slice.count} <span className="text-slate-500">({Math.round(slice.count / total * 100)}%)</span></span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Incident trends" subtitle="Opened uses created_at; resolved uses the recorded resolution time (legacy rows fall back to updated_at).">
          <div className="flex justify-end">
            <select value={trendPeriod} onChange={e => setTrendPeriod(e.target.value as typeof trendPeriod)} aria-label="Trend interval" className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300">
              <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
            </select>
          </div>
          {trends.length === 0 ? <EmptyChart message="No incident timestamps are available for trend reporting." /> : (
            <>
              <svg viewBox="0 0 720 230" className="w-full overflow-visible" role="img" aria-label={`${trendPeriod} opened and resolved incident counts`}>
                {[30, 70, 110, 150, 190].map(y => <line key={y} x1="36" x2="684" y1={y} y2={y} stroke="#1e293b" />)}
                <polyline points={trendPoints('opened')} fill="none" stroke="#22d3ee" strokeWidth="3" />
                <polyline points={trendPoints('resolved')} fill="none" stroke="#34d399" strokeWidth="3" />
                {trends.map((row, index) => {
                  const x = trends.length < 2 ? 360 : 36 + (index / (trends.length - 1)) * 648;
                  return <g key={row.period}>
                    <circle cx={x} cy={190 - (row.opened / maxTrend) * 160} r="4" fill="#22d3ee"><title>{`${row.period}: ${row.opened} opened`}</title></circle>
                    <circle cx={x} cy={190 - (row.resolved / maxTrend) * 160} r="4" fill="#34d399"><title>{`${row.period}: ${row.resolved} resolved`}</title></circle>
                    {(index === 0 || index === trends.length - 1 || index % Math.ceil(trends.length / 5) === 0) && (
                      <text x={x} y="215" textAnchor="middle" fill="#64748b" fontSize="9">{row.period}</text>
                    )}
                  </g>;
                })}
              </svg>
              <div className="flex gap-5 text-[11px] text-slate-400"><span className="text-cyan-300">● Opened</span><span className="text-emerald-300">● Resolved</span></div>
            </>
          )}
        </Panel>

        <Panel title="Incident severity" subtitle="Recorded incidents by severity, including categories with no current records.">
          {total === 0 ? <EmptyChart /> : (
            <div className="space-y-4">
              {severityCounts.map(row => (
                <div key={row.severity} className="grid grid-cols-[5rem_1fr_2rem] items-center gap-3 text-xs">
                  <span className="text-slate-300">{row.severity}</span>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full" style={{ width: `${total ? row.count / total * 100 : 0}%`, background: row.color }} title={`${row.count} incidents`} />
                  </div>
                  <span className="text-right font-mono text-slate-300">{row.count}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Resolution performance" subtitle="Success rate = verified resolutions / all recorded resolution attempts. Unverified and incomplete attempts stay unresolved; MTTR averages verified resolutions with a recorded duration.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs text-slate-400">Verified resolution rate</p>
              <p className="mt-2 font-mono text-3xl font-bold text-emerald-300">{successRate === null ? '—' : `${successRate}%`}</p>
              <p className="mt-2 text-[11px] text-slate-500">{metrics.verified_resolutions} verified / {metrics.resolution_attempts} recorded attempts</p>
              {successRate !== null && <div className="mt-3 h-2 rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${successRate}%` }} /></div>}
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs text-slate-400">Mean time to resolution</p>
              <p className="mt-2 font-mono text-3xl font-bold text-cyan-300">{metrics.avg_resolution_time_minutes ? `${metrics.avg_resolution_time_minutes} min` : '—'}</p>
              <p className="mt-2 text-[11px] text-slate-500">Average duration of verified resolutions with positive recorded time.</p>
            </div>
          </div>
        </Panel>

        <Panel title="Analyst workload" subtitle="Select an analyst or the unassigned row to filter the incident register.">
          {(charts?.analyst_workload || []).length === 0 && metrics.unassigned_incidents === 0 ? <EmptyChart /> : (
            <div className="space-y-4">
              {(charts?.analyst_workload || []).map((row, index) => {
                const max = Math.max(1, ...charts!.analyst_workload.map(item => item.total_assigned));
                return <button key={row.analyst_id} onClick={() => onFilterIncidents({ analystId: row.analyst_id })} className="block w-full space-y-1.5 text-left">
                  <div className="flex justify-between text-xs"><span className="text-slate-300">{row.analyst}</span><span className="font-mono text-slate-400">{row.total_assigned} assigned</span></div>
                  <div className="flex h-3 overflow-hidden rounded-full bg-slate-800" title={`${row.active} active, ${row.resolved} resolved`}>
                    <span style={{ width: `${row.active / max * 100}%`, background: COLORS[index % COLORS.length] }} />
                    <span style={{ width: `${row.resolved / max * 100}%`, background: '#34d399' }} />
                  </div>
                  <div className="flex gap-4 text-[10px] text-slate-500"><span>{row.active} active</span><span>{row.resolved} resolved</span></div>
                </button>;
              })}
              <button onClick={() => onFilterIncidents({ unassigned: true })} className="flex w-full items-center justify-between border-t border-slate-800 pt-3 text-xs hover:text-rose-200">
                <span className="text-rose-300">Unassigned</span><span className="font-mono text-slate-200">{metrics.unassigned_incidents}</span>
              </button>
              <div className="flex gap-4 text-[10px] text-slate-500"><span>■ Active</span><span className="text-emerald-300">■ Resolved</span></div>
            </div>
          )}
        </Panel>

        <Panel title="Investigation outcomes" subtitle="Counts are based only on saved investigation_actions records.">
          {metrics.successful_actions + metrics.failed_actions + (charts?.action_distribution || []).reduce((sum, row) => sum + row.count, 0) === 0 ? <EmptyChart /> : (
            <div className="space-y-3">
              {actionCounts.map(row => {
                const allActions = actionCounts.reduce((sum, item) => sum + item.count, 0);
                return <div key={row.result} className="grid grid-cols-[6rem_1fr_2rem] items-center gap-3 text-xs">
                  <span className="text-slate-300">{row.result}</span>
                  <div className="h-2.5 rounded-full bg-slate-800"><div className="h-2.5 rounded-full" style={{ width: `${allActions ? row.count / allActions * 100 : 0}%`, background: row.color }} /></div>
                  <span className="text-right font-mono text-slate-300">{row.count}</span>
                </div>;
              })}
            </div>
          )}
        </Panel>

        <Panel title="Escalation analytics" subtitle="Manager review states come from persisted escalation_requests.status values.">
          {escalationCounts.reduce((sum, row) => sum + row.count, 0) === 0 ? <EmptyChart message="No escalation requests have been recorded." /> : (
            <div className="grid grid-cols-2 gap-3">
              {escalationCounts.map(row => (
                <div key={row.status} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                  <div className="flex items-center justify-between text-xs"><span className="text-slate-300">{row.status}</span><span className="font-mono" style={{ color: row.color }}>{row.count}</span></div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-800"><div className="h-full rounded-full" style={{ width: `${row.count ? Math.max(8, row.count / Math.max(1, metrics.pending_escalation_reviews, ...escalationCounts.map(item => item.count)) * 100) : 0}%`, background: row.color }} /></div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};
