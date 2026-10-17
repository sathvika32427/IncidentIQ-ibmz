import React, { useState } from 'react';
import { Search, Sparkles, CheckCircle2, XCircle, ArrowRight, Shield, Database, RefreshCw } from 'lucide-react';
import { SimilarityMatch, Role } from '../../types';
import { StatusBadge, SeverityBadge } from '../common/Badge';
import { api } from '../../services/api';

interface SimilarSearchViewProps {
  onSelectIncident: (id: string) => void;
  userRole: Role;
}

export const SimilarSearchView: React.FC<SimilarSearchViewProps> = ({
  onSelectIncident,
  userRole
}) => {
  const [queryTitle, setQueryTitle] = useState('Multiple sshd authentication failures targeting root');
  const [queryDesc, setQueryDesc] = useState('Consecutive check pass user unknown on port 22 with external brute force bursts');
  const [component, setComponent] = useState('sshd(pam_unix)');
  const [results, setResults] = useState<SimilarityMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!queryTitle && !queryDesc) return;

    try {
      setSearching(true);
      const res = await api.searchSimilarity({
        title: queryTitle,
        description: queryDesc,
        component
      });
      setResults(res.matches);
      setHasSearched(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100 tracking-tight">
          Similar Incident Memory Search
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Compare incident keywords with stored incidents. Recorded actions and outcomes are references for human review; similarity does not prove a previous fix will work.
        </p>
      </div>

      {/* Query Form */}
      <form onSubmit={handleSearch} className="bg-[#0f172a] border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Incident Symptom Query / Error Code
            </label>
            <input
              type="text"
              value={queryTitle}
              onChange={(e) => setQueryTitle(e.target.value)}
              placeholder="e.g., authentication failure user unknown root / logrotate ALERT exited abnormally"
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Component / Daemon Focus
            </label>
            <select
              value={component}
              onChange={(e) => setComponent(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
            >
              <option value="">Any Component</option>
              <option value="sshd(pam_unix)">sshd(pam_unix) - SSH Authentication</option>
              <option value="logrotate">logrotate - Log Management Daemon</option>
              <option value="klogind">klogind - Kerberos Auth Daemon</option>
              <option value="ftpd">ftpd - File Transfer Daemon</option>
              <option value="kernel">kernel - Operating System Core</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Detailed Diagnostic Context (Optional)
          </label>
          <input
            type="text"
            value={queryDesc}
            onChange={(e) => setQueryDesc(e.target.value)}
            placeholder="Paste log snippets, exit codes, or observed partition behaviors..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Keyword-frequency cosine score (not machine learning)</span>
          </div>

          <button
            type="submit"
            disabled={searching}
            className="px-5 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 rounded-xl transition-all shadow-md shadow-cyan-950/40 flex items-center gap-1.5"
          >
            {searching ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Searching Memory...</span>
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>Search Incident Memory</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Results Section */}
      <div className="space-y-4">
        {hasSearched && (
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              Found <strong className="text-slate-200">{results.length}</strong> matching historical memory records
            </span>
            <span className="font-mono text-[11px]">Ranked by keyword similarity</span>
          </div>
        )}

        {hasSearched && results.length === 0 ? (
          <div className="p-12 text-center bg-[#0f172a] border border-dashed border-slate-800 rounded-2xl space-y-2">
            <Database className="w-8 h-8 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">No stored incident matched these keywords.</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No similarity result is a verified resolution. Only incidents and investigation outcomes already recorded in this database can appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {results.map((match) => (
              <div
                key={match.incident_id}
                className="bg-[#0f172a] border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-sm hover:border-slate-700 transition-colors"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-cyan-400 font-bold text-xs">{match.incident_id}</span>
                      <SeverityBadge severity={match.severity} />
                      <StatusBadge status={match.status} />
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800/80">
                        {match.similarity_percentage}% · {match.similarity_label}
                      </span>
                      {match.is_demo_data && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950/60 text-amber-300 border border-amber-800/60">
                          Seeded demo incident
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-slate-100">{match.title}</h3>
                    <p className="text-xs text-slate-400">{match.affected_system}</p>
                  </div>

                  <button
                    onClick={() => onSelectIncident(match.incident_id)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-center"
                  >
                    <span>View Investigation</span>
                    <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                  </button>
                </div>

                {/* Matching Terms */}
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-400">
                  <span className="font-mono text-slate-500">Matched keywords:</span>
                  {match.matching_terms.map(t => (
                    <span key={t} className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300 font-mono">
                      {t}
                    </span>
                  ))}
                </div>
                {match.matching_terms.length === 0 && (
                  <p className="text-[11px] text-slate-500">No shared keywords were recorded.</p>
                )}

                {/* Outcome Aware Memory Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80 text-xs">
                  {/* Actions summary */}
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-slate-300 font-medium">
                      <span>Recorded Actions (human review)</span>
                      <span className="font-mono text-slate-400">{match.recorded_actions_count} total</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] pt-1">
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{match.successful_actions_count} Succeeded</span>
                      </span>
                      <span className="text-rose-400 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{match.failed_actions_count} Failed Attempts</span>
                      </span>
                    </div>
                  </div>

                  {/* Resolution Guidance */}
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-300">Stored Outcome Reference</span>
                      <span className={`text-[10px] font-mono px-1.5 rounded uppercase font-semibold ${
                        match.outcome_type === 'Verified' ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {match.outcome_type}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 line-clamp-2">
                      {match.resolution_summary || 'No resolution summary is recorded for this incident.'}
                    </p>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
