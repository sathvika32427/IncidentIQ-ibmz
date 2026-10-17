import React, { useState, useEffect } from 'react';
import { FileText, Search, RefreshCw } from 'lucide-react';
import { AuditEvent } from '../../types';
import { api } from '../../services/api';

export const AuditTrailView: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchAudit = async () => {
    try {
      setLoading(true);
      const res = await api.getAuditTrail();
      setEvents(res.events);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, []);

  const filtered = events.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.action.toLowerCase().includes(q) ||
           e.actor_name.toLowerCase().includes(q) ||
           (e.incident_id && e.incident_id.toLowerCase().includes(q)) ||
           e.details.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            Audit Trail
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Audit events currently stored in SQLite. This trail is not immutable or tamper-proof; seeded records are labeled as demo data.
          </p>
        </div>

        <button
          onClick={fetchAudit}
          className="px-3.5 py-1.5 text-xs text-slate-300 hover:text-slate-100 bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 self-start sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Refresh Audit Trail</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-[#0f172a] border border-slate-800/80 rounded-2xl p-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit action, actor name, incident ID, or change details..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0f172a] border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/40 text-slate-400 text-[11px] uppercase">
                <th className="py-3 px-4 w-44">Timestamp</th>
                <th className="py-3 px-4 w-48">Action Type</th>
                <th className="py-3 px-4 w-44">Actor</th>
                <th className="py-3 px-4 w-32">Incident</th>
                <th className="py-3 px-4">Audit Record Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-500 font-sans">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-cyan-400 mb-2" />
                    Loading audit records...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-500 font-sans">
                    No audit records matching your filter.
                  </td>
                </tr>
              ) : (
                filtered.map((aud) => (
                  <tr key={aud.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                      {aud.timestamp}
                    </td>
                    <td className="py-3 px-4 text-cyan-400 font-bold">
                      {aud.action}
                    </td>
                    <td className="py-3 px-4 text-slate-200 font-sans">
                      <span className="font-medium">{aud.actor_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono block uppercase">({aud.actor_role})</span>
                      {aud.is_synthetic_demo_user === 1 && (
                        <span className="text-[10px] text-amber-300 font-mono block">Synthetic demo user</span>
                      )}
                      {aud.is_seeded_demo_data === 1 && (
                        <span className="text-[10px] text-amber-300 font-mono block">Seeded demo data</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-cyan-300 font-bold">
                      {aud.incident_id || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-sans max-w-lg">
                      {aud.details}
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
