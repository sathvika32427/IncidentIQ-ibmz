import React from 'react';
import {
  LayoutDashboard,
  AlertTriangle,
  Search,
  GitCompare,
  History,
  Sparkles,
  Terminal,
  BookOpen,
  ArrowUpRight,
  Users,
  BarChart3,
  Box,
  FileText,
  HelpCircle,
  ShieldCheck,
  Cpu
} from 'lucide-react';
import { Role } from '../../types';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  userRole: Role;
  pendingEscalationsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  userRole,
  pendingEscalationsCount
}) => {
  const isReporter = userRole === 'reporter';
  const isManager = userRole === 'manager';

  const workspaceNav = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'incidents', label: isReporter ? 'My Incidents' : 'Incidents', icon: AlertTriangle },
    { id: 'similarity', label: 'Similar Incident Search', icon: Search },
    { id: 'comparison', label: 'Incident Comparison', icon: GitCompare },
    { id: 'actions', label: 'Investigation History', icon: History, hideForReporter: true },
    { id: 'recommendations', label: 'Recommendations', icon: Sparkles },
    { id: 'logs', label: 'Log Explorer', icon: Terminal, hideForReporter: true },
    { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen }
  ];

  const managementNav = [
    { 
      id: 'escalations', 
      label: 'Escalation Queue', 
      icon: ArrowUpRight, 
      badge: pendingEscalationsCount > 0 ? pendingEscalationsCount : undefined,
      badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
    },
    { id: 'team', label: 'Team & Assignments', icon: Users, hideForReporter: true },
    { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3, hideForReporter: true }
  ];

  const systemNav = [
    { id: 'workflow', label: 'Workflow & 3D Demo', icon: Box },
    { id: 'audit', label: 'Audit Trail', icon: FileText, hideForReporter: true },
    { id: 'guide', label: 'Demo Guide & Arch', icon: HelpCircle }
  ];

  return (
    <aside className="w-64 bg-[#0a0f1d] border-r border-slate-800/80 flex flex-col shrink-0 min-h-screen text-slate-300 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500/20 via-blue-600/30 to-purple-600/20 border border-cyan-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-950/20">
          <img src="/incidentiq-icon.svg" alt="IncidentIQ" className="w-7 h-7" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-100 tracking-tight text-base font-display">Incident<span className="text-cyan-400">IQ</span></span>
            <span className="text-[10px] uppercase font-mono px-1 py-0.2 bg-slate-800/80 text-cyan-300 border border-slate-700/60 rounded">z16</span>
          </div>
          <div className="text-[11px] text-slate-500 tracking-tight flex items-center gap-1">
            <span>Zenvora</span>
            <span>·</span>
            <span>IBM Z Memory</span>
          </div>
        </div>
      </div>

      {/* Role Badge Indicator */}
      <div className="px-5 py-2.5 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between text-xs">
        <span className="text-slate-400 font-mono text-[11px]">ACTIVE ROLE</span>
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase border ${
          isManager 
            ? 'bg-purple-950/60 text-purple-300 border-purple-800/60' 
            : isReporter 
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60' 
              : 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60'
        }`}>
          {userRole}
        </span>
      </div>

      {/* Scrollable Nav List */}
      <div className="flex-1 py-4 px-3 space-y-6 overflow-y-auto">
        {/* Workspace */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-mono tracking-wider text-slate-400 uppercase">
            Workspace
          </div>
          <div className="space-y-0.5">
            {workspaceNav.map(item => {
              if (item.hideForReporter && isReporter) return null;
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Management (Hidden for pure Reporters, full for Managers) */}
        {!isReporter && (
          <div>
            <div className="px-3 mb-2 text-[10px] font-mono tracking-wider text-slate-400 uppercase">
              Management
            </div>
            <div className="space-y-0.5">
              {managementNav.map(item => {
                if (item.hideForReporter && isReporter) return null;
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${item.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* System & Architecture */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-mono tracking-wider text-slate-400 uppercase">
            System & Architecture
          </div>
          <div className="space-y-0.5">
            {systemNav.map(item => {
              if (item.hideForReporter && isReporter) return null;
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer System Status */}
      <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>Intended Target</span>
          </div>
          <span className="font-mono text-cyan-300 font-semibold">LinuxONE (unverified)</span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>Fallback</span>
          <span className="font-mono text-slate-400">Rule-based mode</span>
        </div>
      </div>
    </aside>
  );
};
