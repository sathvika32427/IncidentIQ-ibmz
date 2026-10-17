import React, { useState, useEffect } from 'react';
import { BookOpen, CheckCircle2, XCircle, Search, RefreshCw, FileText, Check } from 'lucide-react';
import { ResolutionKnowledge } from '../../types';
import { api } from '../../services/api';

export const KnowledgeBaseView: React.FC = () => {
  const [items, setItems] = useState<ResolutionKnowledge[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchKb = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.getKnowledgeBase();
      setItems(res.items);
    } catch (err) {
      console.error(err);
      setLoadError(err instanceof Error ? err.message : 'Unable to load knowledge records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKb();
  }, []);

  const filtered = items.filter(i => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return i.pattern_name.toLowerCase().includes(q) || 
           i.component.toLowerCase().includes(q) || 
           i.symptoms.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100 tracking-tight">
          Reusable Incident Memory & Resolution Knowledge Base
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Stored procedures and outcomes are references for human review. Reuse events and independent verifier identities are not recorded by this application.
        </p>
      </div>

      {loadError && (
        <div role="alert" className="rounded-xl border border-rose-800/70 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
          Knowledge data could not be loaded from the API: {loadError}
        </div>
      )}

      {/* Search */}
      <div className="bg-[#0f172a] border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search verified resolution patterns, component names, or failure lessons..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <button
          onClick={fetchKb}
          className="px-3 py-2 text-xs text-slate-300 hover:text-slate-100 bg-slate-900 border border-slate-700 rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Grid */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400 mb-2" />
            <p className="text-xs">Loading resolution knowledge from SQLite...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center bg-[#0f172a] border border-dashed border-slate-800 rounded-2xl space-y-2">
            <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">No knowledge procedures found.</h3>
            <p className="text-xs text-slate-500">
              Stored procedures are references only; verify the current symptoms and environment before using them.
            </p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="bg-[#0f172a] border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-sm hover:border-slate-700 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-cyan-400 font-bold text-xs">{item.id}</span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-950/60 text-cyan-300 border border-cyan-800/60">
                      {item.component}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                      <Check className="w-3 h-3" />
                      <span>Recorded: {item.outcome_type}</span>
                    </span>
                    {item.is_demo_data === 1 && (
                      <span className="text-[10px] text-amber-300 font-mono">Seeded demo data</span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-100">{item.pattern_name}</h3>
                </div>

                <div className="text-right text-xs font-mono text-slate-400 shrink-0">
                  <span>Reuse count: <strong className="text-cyan-300">Not yet recorded</strong></span>
                  <span className="block text-[11px] text-slate-500 font-sans mt-0.5">Verifier: No verification record</span>
                </div>
              </div>

              {/* Symptoms */}
              <div className="space-y-1 text-xs">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">Observed Symptoms</span>
                <p className="text-slate-300 bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/60">
                  {item.symptoms}
                </p>
              </div>

              {/* Verified Procedure */}
              <div className="space-y-1.5 text-xs">
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block font-semibold">
                  Stored Procedure (human review required)
                </span>
                <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/40 text-emerald-100 whitespace-pre-line leading-relaxed font-mono text-[11px]">
                  {item.verified_procedure}
                </div>
              </div>

              {/* Negative Knowledge / Failed Attempts */}
              {item.failed_actions_summary && (
                <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-900/40 text-xs text-rose-200 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-rose-400 font-semibold block">
                    Recorded Failure Caveats (Do NOT Repeat)
                  </span>
                  <p>{item.failed_actions_summary}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
