import React from 'react';
import { Severity, IncidentStatus } from '../../types';

interface StatusBadgeProps {
  status: IncidentStatus | string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  // Enterprise unboxed status with subtle text indicator and accessible WCAG AA contrast
  let color = 'text-slate-400 border-slate-700 bg-slate-800/60';
  let dotColor = 'bg-slate-400';

  switch (status) {
    case 'Open':
      color = 'text-sky-300 border-sky-800/80 bg-sky-950/40';
      dotColor = 'bg-sky-400';
      break;
    case 'In Progress':
      color = 'text-teal-300 border-teal-800/80 bg-teal-950/40';
      dotColor = 'bg-teal-400';
      break;
    case 'Resolved':
      color = 'text-emerald-300 border-emerald-800/80 bg-emerald-950/40';
      dotColor = 'bg-emerald-400';
      break;
    case 'Unresolved':
      color = 'text-rose-300 border-rose-800/80 bg-rose-950/40';
      dotColor = 'bg-rose-400';
      break;
    case 'Escalation Requested':
      color = 'text-amber-300 border-amber-800/80 bg-amber-950/40';
      dotColor = 'bg-amber-400';
      break;
    case 'Escalated':
      color = 'text-purple-300 border-purple-800/80 bg-purple-950/40';
      dotColor = 'bg-purple-400';
      break;
    case 'Reopened':
      color = 'text-orange-300 border-orange-800/80 bg-orange-950/40';
      dotColor = 'bg-orange-400';
      break;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border ${color} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{status}</span>
    </span>
  );
};

interface SeverityBadgeProps {
  severity: Severity | string;
  className?: string;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, className = '' }) => {
  let style = 'text-slate-400 bg-slate-800/60 border-slate-700';

  switch (severity) {
    case 'Critical':
      style = 'text-rose-300 bg-rose-950/50 border-rose-800/80 font-semibold';
      break;
    case 'High':
      style = 'text-amber-300 bg-amber-950/50 border-amber-800/80 font-medium';
      break;
    case 'Medium':
      style = 'text-sky-300 bg-sky-950/40 border-sky-800/70';
      break;
    case 'Low':
      style = 'text-slate-300 bg-slate-800/40 border-slate-700/60';
      break;
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border tabular-nums ${style} ${className}`}>
      {severity}
    </span>
  );
};
