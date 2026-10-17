import React, { useState } from 'react';
import { GitCompare, CheckCircle2, XCircle, Clock, ShieldAlert, ArrowRight, ArrowUpRight } from 'lucide-react';
import { Incident } from '../../types';
import { StatusBadge, SeverityBadge } from '../common/Badge';

interface IncidentComparisonViewProps {
  incidents: Incident[];
  onSelectIncident: (id: string) => void;
}

export const IncidentComparisonView: React.FC<IncidentComparisonViewProps> = ({
  incidents,
  onSelectIncident
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([
    incidents[0]?.id || 'INC-Z-1042',
    incidents[1]?.id || 'INC-Z-1105'
  ]);

  const selectedIncidents = incidents.filter(i => selectedIds.includes(i.id));

  const toggleSelectIncident = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length > 1) {
        setSelectedIds(selectedIds.filter(x => x !== id));
      }
    } else {
      if (selectedIds.length < 3) {
        setSelectedIds([...selectedIds, id]);
      } else {
        setSelectedIds([selectedIds[1], selectedIds[2], id]);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100 tracking-tight">
          Multi-Vector Incident Comparison
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Compare 2 or 3 incidents side-by-side to contrast symptoms, partition environments, actions that worked vs failed, and resolution evidence.
        </p>
      </div>

      {/* Selector Ribbon */}
      <div className="bg-[#0f172a] border border-slate-800/80 rounded-2xl p-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-mono text-slate-400 mr-2">Select Incidents (Max 3):</span>
        {incidents.map((inc) => {
          const isSelected = selectedIds.includes(inc.id);
          return (
            <button
              key={inc.id}
              onClick={() => toggleSelectIncident(inc.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-colors border ${
                isSelected
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {inc.id} ({inc.severity})
            </button>
          );
        })}
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {selectedIncidents.map((inc) => (
          <div
            key={inc.id}
            className="bg-[#0f172a] border border-slate-800/80 rounded-2xl p-5 space-y-5 shadow-sm flex flex-col justify-between"
          >
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <span className="font-mono text-base font-bold text-cyan-400">{inc.id}</span>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={inc.severity} />
                  <StatusBadge status={inc.status} />
                </div>
              </div>

              {/* Title & Symptoms */}
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">Symptoms</span>
                <h3 className="text-sm font-semibold text-slate-100">{inc.title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/60">
                  {inc.description}
                </p>
              </div>

              {/* System & Partition */}
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">Target Partition / Architecture</span>
                <p className="text-xs text-slate-200 font-mono bg-slate-900/40 p-2 rounded-lg border border-slate-800/60">
                  {inc.affected_system}
                </p>
              </div>

              {/* Category & Reporter */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800/50">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">Category</span>
                  <span className="text-slate-200 font-medium">{inc.category}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800/50">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">Reporter</span>
                  <span className="text-slate-200 font-medium">{inc.reporter_name}</span>
                </div>
              </div>

              {/* Recorded Outcome Memory */}
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">Recorded Outcome & Fix</span>
                <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                  inc.status === 'Resolved'
                    ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-200'
                    : 'bg-slate-900/40 border-slate-800/60 text-slate-300'
                }`}>
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="font-semibold">{inc.status}</span>
                    <span className="text-slate-400">Verified: {inc.resolution_verified}</span>
                  </div>
                  <p className="leading-relaxed">
                    {inc.resolution_summary || 'Incident is currently active in investigation.'}
                  </p>
                  {inc.resolution_evidence && (
                    <p className="text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-800">
                      Evidence: {inc.resolution_evidence}
                    </p>
                  )}
                </div>
              </div>

              {/* Resolution Metrics */}
              <div className="flex items-center justify-between text-xs text-slate-400 p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/50">
                <span>Time to Resolution:</span>
                <span className="font-mono text-slate-200 font-semibold tabular-nums">
                  {inc.resolution_time_minutes > 0 ? `${inc.resolution_time_minutes} minutes` : 'In Progress'}
                </span>
              </div>
            </div>

            {/* Inspect Button */}
            <button
              onClick={() => onSelectIncident(inc.id)}
              className="w-full py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Inspect Incident Timeline</span>
              <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
