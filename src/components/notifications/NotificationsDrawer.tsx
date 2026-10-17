import React from 'react';
import { X, Bell, Check, ArrowRight, ShieldAlert, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { NotificationItem } from '../../types';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onSelectIncident: (id: string) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkRead,
  onMarkAllRead,
  onSelectIncident
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed top-16 right-4 z-40 w-full max-w-sm bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[500px]">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-slate-100">Notifications</h3>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
            {notifications.filter(n => !n.read).length} new
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onMarkAllRead}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Mark all read
          </button>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
        {notifications.length === 0 ? (
          <p className="text-xs text-slate-500 py-8 text-center">No notifications right now.</p>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                onMarkRead(n.id);
                if (n.incident_id) {
                  onSelectIncident(n.incident_id);
                  onClose();
                }
              }}
              className={`p-3 rounded-xl border cursor-pointer transition-colors space-y-1 ${
                n.read
                  ? 'bg-slate-900/40 border-slate-800/60 text-slate-400'
                  : 'bg-slate-900 border-cyan-800/40 text-slate-200 hover:border-cyan-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">{n.title}</span>
                <span className="text-[10px] font-mono text-slate-500">{n.created_at?.slice(11, 16)}</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">{n.message}</p>
              {n.incident_id && (
                <div className="flex items-center gap-1 text-[10px] font-mono text-cyan-400 pt-1">
                  <span>Incident: {n.incident_id}</span>
                  <ArrowRight className="w-2.5 h-2.5" />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
