import React from 'react';
import {
  Bell,
  PlayCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Shield,
  MessageSquare
} from 'lucide-react';
import { User, AIAvailability } from '../../types';

interface HeaderProps {
  currentTab: string;
  currentUser: User;
  users: User[];
  onSwitchUser: (user: User) => void;
  onOpenNewIncidentModal: () => void;
  onOpenGuidedDemo: () => void;
  onToggleNotifications: () => void;
  onToggleChat: () => void;
  unreadNotificationsCount: number;
  aiStatus: AIAvailability;
  onResetDemoData: () => void;
  isResetting: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  currentUser,
  users,
  onSwitchUser,
  onOpenNewIncidentModal,
  onOpenGuidedDemo,
  onToggleNotifications,
  onToggleChat,
  unreadNotificationsCount,
  aiStatus,
  onResetDemoData,
  isResetting
}) => {
  const getTabLabel = (tab: string) => {
    switch (tab) {
      case 'overview': return 'Overview Dashboard';
      case 'incidents': return 'Incident Management & Triage';
      case 'similarity': return 'Similar Incident Search Engine';
      case 'comparison': return 'Incident Multi-Vector Comparison';
      case 'actions': return 'Investigation Action History';
      case 'recommendations': return 'Resolution Recommendations';
      case 'logs': return 'Log Explorer & Ingestion';
      case 'knowledge': return 'Resolution Knowledge Base';
      case 'escalations': return 'Human Escalation Queue';
      case 'team': return 'Team Workload & Assignments';
      case 'analytics': return 'Manager Analytics & Reports';
      case 'workflow': return '3D Incident Workflow Architecture';
      case 'audit': return 'Audit Trail & Compliance';
      case 'guide': return 'Demo Guide & Deployment Architecture';
      default: return 'IncidentIQ';
    }
  };

  return (
    <header className="h-16 bg-[#0c1222] border-b border-slate-800/80 px-6 flex items-center justify-between gap-6 shrink-0 z-20">
      {/* Zone 1: Breadcrumbs & Section Title */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-slate-400">IncidentIQ</span>
        <span className="text-slate-500">/</span>
        <h1 className="text-sm font-semibold text-slate-100 tracking-tight whitespace-nowrap">
          {getTabLabel(currentTab)}
        </h1>

        {/* Demo Data indicator */}
        <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
          <span>SYNTHETIC DEMO USERS</span>
        </span>
      </div>

      {/* Zone 2 & 3: Controls and Actions */}
      <div className="flex items-center gap-3">
        {/* Reset Demo Data button */}
        <button
          onClick={onResetDemoData}
          disabled={isResetting}
          title="Reset seeded demo incidents without deleting imported dataset"
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-slate-800 rounded-lg transition-colors whitespace-nowrap"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Reset Demo</span>
        </button>

        {/* Guided Interactive Demo Button */}
        <button
          onClick={onOpenGuidedDemo}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-800/60 rounded-lg transition-colors whitespace-nowrap shadow-sm"
        >
          <PlayCircle className="w-3.5 h-3.5 text-cyan-400" />
          <span>Interactive Demo Tour</span>
        </button>

        {/* AI Mode Pill Status */}
        <div
          className="hidden md:flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-slate-800 bg-slate-900/50 text-slate-400"
          title={aiStatus.message}
        >
          <Sparkles className={`w-3.5 h-3.5 ${aiStatus.state === 'available' ? 'text-cyan-400' : 'text-slate-500'}`} />
          <span className="text-[11px] font-mono">
            {aiStatus.state === 'available'
              ? 'AI responding (Gemini verified)'
              : aiStatus.state === 'configured-unavailable'
                ? 'AI configured but unavailable — using rule-based mode'
                : aiStatus.state === 'not-configured'
                  ? 'AI assistance unavailable — using rule-based mode.'
                  : aiStatus.state === 'checking'
                    ? 'Checking AI availability'
                    : 'AI configured — verification pending'}
          </span>
        </div>

        {/* Role Switcher (Demonstration Login) */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <label className="text-[10px] uppercase font-mono text-slate-400 hidden sm:inline">Role:</label>
          <select
            value={currentUser.id}
            onChange={(e) => {
              const selected = users.find(u => u.id === e.target.value);
              if (selected) onSwitchUser(selected);
            }}
            aria-label="Switch active demonstration user role"
            className="text-xs bg-slate-900 border border-slate-700/80 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-medium cursor-pointer"
          >
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role.toUpperCase()}){u.is_demo_user ? ' — synthetic demo user' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Chat Assistant Toggle Button */}
        <button
          onClick={onToggleChat}
          title="IncidentIQ Assistant"
          className="relative p-2 text-slate-300 hover:text-cyan-300 hover:bg-slate-800/60 rounded-lg transition-colors"
          aria-label="Open AI Assistant"
        >
          <MessageSquare className="w-4 h-4" />
        </button>

        {/* Notification Bell */}
        <button
          onClick={onToggleNotifications}
          className="relative p-2 text-slate-300 hover:text-slate-100 hover:bg-slate-800/60 rounded-lg transition-colors"
          aria-label="View notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-[#0c1222]" />
          )}
        </button>

        {/* Primary Action Button: Register Incident */}
        <button
          onClick={onOpenNewIncidentModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 rounded-lg transition-all shadow-md shadow-cyan-950/40 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Incident</span>
        </button>
      </div>
    </header>
  );
};
