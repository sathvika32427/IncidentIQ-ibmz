import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Terminal,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
  Layers
} from 'lucide-react';
import { Incident } from '../../types';
import { api } from '../../services/api';

interface RecommendationsViewProps {
  incidents: Incident[];
  onSelectIncident: (id: string) => void;
}

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({
  incidents,
  onSelectIncident
}) => {
  const [selectedIncidentId, setSelectedIncidentId] = useState(incidents[0]?.id || 'INC-Z-1042');
  const [recommendation, setRecommendation] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const selectedIncident = incidents.find(i => i.id === selectedIncidentId);

  const fetchRec = async (id: string) => {
    try {
      setLoading(true);
      const res = await api.getRecommendations(id);
      setRecommendation(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedIncidentId) {
      fetchRec(selectedIncidentId);
    }
  }, [selectedIncidentId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 tracking-tight">
          Outcome-Aware Recommendation Engine
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Uses rule-based triage and stored keyword matches. Historical actions and outcomes are references for human review, not guarantees that a past fix applies.
        </p>
      </div>

      {/* Incident Switcher */}
      <div className="bg-[#0f172a] border border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">Target Incident:</span>
          <select
            value={selectedIncidentId}
            onChange={(e) => setSelectedIncidentId(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer font-medium"
          >
            {incidents.map(inc => (
              <option key={inc.id} value={inc.id}>
                {inc.id} — {inc.title} ({inc.severity}, {inc.status})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => fetchRec(selectedIncidentId)}
          className="px-3 py-1.5 text-xs text-slate-300 hover:text-slate-100 bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5 self-start sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Re-Evaluate Memory</span>
        </button>
      </div>

      {/* Recommendation Results */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 bg-[#0f172a] rounded-2xl border border-slate-800">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400 mb-2" />
          <p className="text-xs">Comparing incident keywords and recorded action outcomes...</p>
        </div>
      ) : recommendation ? (
        <div className="space-y-6">
          {/* Engine Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-purple-950/30 border border-cyan-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-100 font-display">Investigation Recommendation</span>
                  <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-cyan-900/60 text-cyan-300 border border-cyan-700/60 uppercase">
                    Mode: {recommendation.mode}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Synthesized for incident <strong className="text-cyan-300 font-mono">{selectedIncidentId}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-500 block text-[10px]">HISTORICAL SIMILARITY</span>
                <span className="text-emerald-400 font-bold text-sm">
                  {recommendation.similarity_percentage === undefined
                    ? 'No match'
                    : `${recommendation.similarity_percentage}% keyword match`}
                </span>
              </div>
              <div className="border-l border-slate-800 pl-4">
                <span className="text-slate-500 block text-[10px]">HISTORICAL OUTCOME</span>
                <span className="text-cyan-300 font-bold">{recommendation.previous_outcome}</span>
              </div>
            </div>
          </div>

          {/* Primary Suggested Action Card */}
          <div className="bg-[#0f172a] border border-slate-800/80 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="space-y-2">
              <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                Prioritized Next Diagnostic Step
              </span>
              <h3 className="text-lg font-bold text-slate-100">
                {recommendation.suggested_step}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                {recommendation.rationale}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Supporting Log Evidence:</span>
              <span className="text-slate-400 font-sans">{recommendation.supporting_evidence}</span>
            </div>

            {recommendation.warning && (
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-900/60 text-xs text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>{recommendation.warning}</span>
              </div>
            )}
          </div>

          {/* Cautionary Failed Actions Warning */}
          {recommendation.cautionary_failed_steps?.length > 0 && (
            <div className="bg-[#0f172a] border border-rose-900/60 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs">
                <XCircle className="w-4 h-4 text-rose-400" />
                <span>NEGATIVE KNOWLEDGE LESSON: Actions That Previously Failed</span>
              </div>
              <p className="text-xs text-slate-400">
                IncidentIQ's memory preserves failed attempts so analysts do not waste critical resolution time repeating non-viable fixes:
              </p>
              <div className="space-y-2">
                {recommendation.cautionary_failed_steps.map((fail: string, idx: number) => (
                  <div key={idx} className="p-3 rounded-xl bg-rose-950/20 border border-rose-900/40 text-xs text-rose-200">
                    {fail}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Side-by-Side Verification: Rule-Based vs AI-Assisted */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase text-slate-400">
              Rule-Based Guidance and AI Response
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Rule-Based Card */}
              <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="font-mono text-cyan-400 font-bold">Rule-Based Diagnostic Mode</span>
                  <span className="text-[10px] text-slate-500 font-mono">Zero External API Required</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono text-slate-500">Proposed Action</span>
                  <p className="font-semibold text-slate-200">{recommendation.side_by_side?.rule_based?.step}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono text-slate-500">Algorithmic Rationale</span>
                  <p className="text-slate-400 leading-relaxed">{recommendation.side_by_side?.rule_based?.rationale}</p>
                </div>
              </div>

              {/* AI-Assisted Card */}
              <div className="bg-[#0f172a] border border-cyan-900/50 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="font-mono text-purple-400 font-bold">AI-Assisted Synthesis (Gemini)</span>
                  <span className="text-[10px] text-purple-400/80 font-mono">Backend Proxy Engine</span>
                </div>
                {recommendation.side_by_side?.ai_assisted ? (
                  <>
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-mono text-slate-500">Proposed Action</span>
                      <p className="font-semibold text-slate-200">{recommendation.side_by_side.ai_assisted.step}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-mono text-slate-500">Contextual Reasoning</span>
                      <p className="text-slate-400 leading-relaxed">{recommendation.side_by_side.ai_assisted.rationale}</p>
                    </div>
                    {recommendation.side_by_side.ai_assisted.nuances && (
                      <p className="text-[11px] text-purple-300 italic pt-1">
                        Nuance: {recommendation.side_by_side.ai_assisted.nuances}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="py-6 text-center text-slate-500 space-y-1">
                    {recommendation.ai_status?.state === 'not-configured' ? (
                      <p>AI assistance unavailable — using rule-based mode.</p>
                    ) : recommendation.ai_status?.state === 'configured-unavailable' ? (
                      <>
                        <p>AI is configured but unavailable; using rule-based mode.</p>
                        {recommendation.ai_status.message && (
                          <p className="text-[11px]">{recommendation.ai_status.message}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-[11px]">No AI response was generated for this request.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
