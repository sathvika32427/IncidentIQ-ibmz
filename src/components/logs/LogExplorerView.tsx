import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Search,
  Filter,
  Link as LinkIcon,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Database,
  ChevronLeft,
  ChevronRight,
  Info
} from 'lucide-react';
import { LogEntry, Incident, User } from '../../types';
import { api } from '../../services/api';

interface LogExplorerViewProps {
  incidents: Incident[];
  onSelectIncident: (id: string) => void;
  currentUser: User;
}

export const LogExplorerView: React.FC<LogExplorerViewProps> = ({
  incidents,
  onSelectIncident,
  currentUser
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [components, setComponents] = useState<Array<{ component: string; count: number }>>([]);
  const [eventIds, setEventIds] = useState<Array<{ event_id: string; count: number }>>([]);
  const [months, setMonths] = useState<Array<{ month: string }>>([]);
  const [selectedComponent, setSelectedComponent] = useState('all');
  const [selectedEventId, setSelectedEventId] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [search, setSearch] = useState('');
  const [limit] = useState(30);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);

  // Link Evidence Modal State
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [targetIncidentId, setTargetIncidentId] = useState(incidents[0]?.id || '');
  const [linkReason, setLinkReason] = useState('Observed anomalous authentication pattern in raw telemetry.');
  const [linking, setLinking] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState(false);

  // CSV Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStatus, setImportStatus] = useState<any>(null);
  const [importing, setImporting] = useState(false);

  const fetchLogs = async (requestedOffset = offset) => {
    try {
      setLoading(true);
      const res = await api.getLogs({
        component: selectedComponent,
        event_id: selectedEventId,
        search,
        month: selectedMonth,
        date: selectedDate,
        time: selectedTime,
        limit,
        offset: requestedOffset
      });
      setLogs(res.logs);
      setTotal(res.total);
      if (res.components?.length > 0) setComponents(res.components);
      if (res.eventIds?.length > 0) setEventIds(res.eventIds);
      setMonths(res.months || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedComponent, selectedEventId, selectedMonth, selectedDate, selectedTime, offset]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    fetchLogs(0);
  };

  const handleLinkEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLog || !targetIncidentId) return;

    try {
      setLinking(true);
      await api.linkLogEvidence(targetIncidentId, {
        line_id: selectedLog.line_id,
        reason: linkReason,
        user_id: currentUser.id
      });
      setLinkSuccess(true);
      setTimeout(() => {
        setLinkSuccess(false);
        setSelectedLog(null);
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Failed to link log evidence');
    } finally {
      setLinking(false);
    }
  };

  const handleReimport = async () => {
    try {
      setImporting(true);
      const res = await api.importLogs();
      setImportStatus(res);
      fetchLogs();
    } catch (err: any) {
      setImportStatus({ error: err.message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            Log Telemetry Explorer & Evidence Pipeline
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Search, filter, and link system logs from the LogHub benchmark dataset to active incident memory investigations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Dataset Ingestion Console</span>
          </button>
        </div>
      </div>

      {/* Dataset Attribution Notice */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-start gap-3 text-xs text-slate-400">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-slate-300">Dataset Context:</strong> The ingested telemetry originates           from the <strong>LogHub Linux 2k structured dataset</strong> (Linux_2k.log_structured.csv), a public Linux log benchmark used for demonstration and investigation. These are not verified IBM Z production logs.
        </p>
      </div>

      {/* Search & Filter Ribbon */}
      <div className="bg-[#0f172a] border border-slate-800/80 rounded-2xl p-4 space-y-3 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search log content, error template, IP address, or process..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedComponent}
              onChange={(e) => {
                setSelectedComponent(e.target.value);
                setOffset(0);
              }}
              className="bg-slate-900 border border-slate-700/80 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
            >
              <option value="all">All Components</option>
              {components.map(c => (
                <option key={c.component} value={c.component}>
                  {c.component} ({c.count})
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by source month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setOffset(0);
              }}
              className="bg-slate-900 border border-slate-700/80 text-slate-300 text-xs rounded-xl px-3 py-2"
            >
              <option value="">All Months</option>
              {months.map(({ month }) => <option key={month} value={month}>{month}</option>)}
            </select>

            <input
              aria-label="Filter by source day of month"
              type="number"
              min="1"
              max="31"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setOffset(0);
              }}
              placeholder="Day"
              className="w-20 bg-slate-900 border border-slate-700/80 text-slate-300 text-xs rounded-xl px-3 py-2"
            />

            <input
              aria-label="Filter by source time"
              type="text"
              value={selectedTime}
              onChange={(e) => {
                setSelectedTime(e.target.value);
                setOffset(0);
              }}
              placeholder="Time (HH:MM)"
              className="w-28 bg-slate-900 border border-slate-700/80 text-slate-300 text-xs rounded-xl px-3 py-2"
            />

            <select
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                setOffset(0);
              }}
              className="bg-slate-900 border border-slate-700/80 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
            >
              <option value="all">All Event IDs</option>
              {eventIds.map(e => (
                <option key={e.event_id} value={e.event_id}>
                  {e.event_id} ({e.count})
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition-colors"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Log Entries Table */}
      <div className="bg-[#0f172a] border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/40 text-slate-400 text-[11px] uppercase">
                <th className="py-3 px-3 w-16 text-center">Line</th>
                <th className="py-3 px-3 w-28">Timestamp</th>
                <th className="py-3 px-3 w-32">Component</th>
                <th className="py-3 px-3 w-20">PID</th>
                <th className="py-3 px-4">Raw Content</th>
                <th className="py-3 px-3 w-24">Event ID</th>
                <th className="py-3 px-3 text-right">Evidence Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500 font-sans">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-cyan-400 mb-2" />
                    Loading structured telemetry records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500 font-sans">
                    No log records match your filter criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.line_id} className="hover:bg-slate-800/40 transition-colors group">
                    <td className="py-3 px-3 text-cyan-400 text-center font-bold">
                      #{log.line_id}
                    </td>
                    <td className="py-3 px-3 text-slate-400 whitespace-nowrap text-[11px]">
                      {log.month} {log.date} {log.time}
                    </td>
                    <td className="py-3 px-3 text-slate-200 font-semibold truncate max-w-[130px]">
                      {log.component}
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {log.pid || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-300 max-w-xl truncate select-all">
                      {log.content}
                    </td>
                    <td className="py-3 px-3 text-purple-400">
                      {log.event_id || '—'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 text-xs font-sans text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/60 rounded-lg transition-colors flex items-center gap-1 ml-auto"
                      >
                        <LinkIcon className="w-3 h-3" />
                        <span>Link to Incident</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Count */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/30 text-xs text-slate-400 flex items-center justify-between">
          <span>
            Showing <strong className="text-slate-200">{offset + 1}</strong> to <strong className="text-slate-200">{Math.min(offset + limit, total)}</strong> of <strong className="text-slate-200">{total}</strong> records
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-slate-100 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-[11px]">
              Page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit) || 1}
            </span>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-slate-100 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Link Evidence Modal Dialog */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0f172a] border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-cyan-400" />
                <span>Link Log Line #{selectedLog.line_id} as Evidence</span>
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-900 text-xs font-mono space-y-1">
              <div className="text-cyan-400 font-bold">[{selectedLog.component}] {selectedLog.month} {selectedLog.date} {selectedLog.time}</div>
              <p className="text-slate-300">{selectedLog.content}</p>
            </div>

            <form onSubmit={handleLinkEvidence} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Target Incident *</label>
                <select
                  value={targetIncidentId}
                  onChange={(e) => setTargetIncidentId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                  required
                >
                  {incidents.map(inc => (
                    <option key={inc.id} value={inc.id}>
                      {inc.id} - {inc.title} ({inc.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Evidence Relevance Rationale *</label>
                <textarea
                  value={linkReason}
                  onChange={(e) => setLinkReason(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                  required
                />
              </div>

              {linkSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Evidence line successfully linked to incident!</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-3.5 py-1.5 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linking || linkSuccess}
                  className="px-4 py-1.5 font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl disabled:opacity-50"
                >
                  {linking ? 'Attaching...' : 'Confirm Evidence Attachment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dataset Ingestion Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0f172a] border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Upload className="w-4 h-4 text-cyan-400" />
                <span>Dataset Ingestion & Validation Pipeline</span>
              </h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>
                The importer reads the supplied CSV headers and preserves their source fields when present:
              </p>
              <div className="p-2.5 bg-slate-900 rounded-xl font-mono text-[11px] text-cyan-300">
                LineId, Month, Date, Time, Level, Component, PID, Content, EventId, EventTemplate
              </div>
              <p className="text-slate-400">
                Original LineIds are retained. Duplicate IDs are skipped without overwriting existing records or linked evidence; malformed rows and skip counts are reported. The source timestamp contains month/day/time but no year.
              </p>

              {importStatus && (
                <div className={`p-3 rounded-xl border text-xs ${
                  importStatus.error
                    ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                    : 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                }`}>
                  {importStatus.error ? (
                    <div>Error: {importStatus.error}</div>
                  ) : (
                    <div>
                      <strong>Import Complete:</strong> Imported {importStatus.imported} new records; skipped {importStatus.skipped} of {importStatus.total_processed} rows from {importStatus.dataset_name}.
                      {importStatus.errors?.length > 0 && (
                        <ul className="mt-2 list-disc pl-4 text-amber-200">
                          {importStatus.errors.slice(0, 5).map((error: string, index: number) => <li key={index}>{error}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
              <button
                onClick={handleReimport}
                disabled={importing}
                className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl disabled:opacity-50 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${importing ? 'animate-spin' : ''}`} />
                <span>{importing ? 'Processing CSV...' : 'Re-Ingest Dataset'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
