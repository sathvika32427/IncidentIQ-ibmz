import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { User } from '../../types';
import { api } from '../../services/api';
import { ShieldCheck, Check, X, RotateCcw, AlertCircle } from 'lucide-react';

interface ReviewEscalationModalProps {
  isOpen: boolean;
  onClose: () => void;
  escalationId: string | null;
  incidentId: string | null;
  currentUser: User;
  onReviewed: () => void;
}

export const ReviewEscalationModal: React.FC<ReviewEscalationModalProps> = ({
  isOpen,
  onClose,
  escalationId,
  incidentId,
  currentUser,
  onReviewed
}) => {
  const [decision, setDecision] = useState<'Approved' | 'Rejected' | 'Returned'>('Approved');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reassignTo, setReassignTo] = useState('USR-SEC-01');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!escalationId || !incidentId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewNotes.trim()) {
      setError('Please provide the operational rationale for your managerial decision.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const analystName = reassignTo === 'USR-SEC-01' ? 'Elena Rostova' : 'Marcus Chen';

      await api.reviewEscalation(escalationId, {
        decision,
        review_notes: reviewNotes.trim(),
        reassign_to_id: decision === 'Approved' ? reassignTo : undefined,
        reassign_to_name: decision === 'Approved' ? analystName : undefined,
        user_id: currentUser.id,
        user_name: currentUser.name,
        user_role: currentUser.role
      });

      onReviewed();
      onClose();
      setReviewNotes('');
    } catch (err: any) {
      setError(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Review Escalation Request (${incidentId})`}
      subtitle="Authorized Incident Manager Decision Console · Server-enforced role verification"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            Manager Decision *
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setDecision('Approved')}
              className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-colors ${
                decision === 'Approved'
                  ? 'bg-purple-950/80 border-purple-500 text-purple-200 shadow-sm'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}
            >
              <Check className="w-4 h-4 text-purple-400" />
              <span>Approve</span>
              <span className="text-[10px] font-normal text-slate-400">Escalate & Assign</span>
            </button>

            <button
              type="button"
              onClick={() => setDecision('Returned')}
              className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-colors ${
                decision === 'Returned'
                  ? 'bg-amber-950/80 border-amber-500 text-amber-200 shadow-sm'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}
            >
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>Return</span>
              <span className="text-[10px] font-normal text-slate-400">Request Evidence</span>
            </button>

            <button
              type="button"
              onClick={() => setDecision('Rejected')}
              className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-colors ${
                decision === 'Rejected'
                  ? 'bg-rose-950/80 border-rose-500 text-rose-200 shadow-sm'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}
            >
              <X className="w-4 h-4 text-rose-400" />
              <span>Reject</span>
              <span className="text-[10px] font-normal text-slate-400">Decline Escalation</span>
            </button>
          </div>
        </div>

        {decision === 'Approved' && (
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Assign Escalated Ownership to Senior Specialist *
            </label>
            <select
              value={reassignTo}
              onChange={(e) => setReassignTo(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
            >
              <option value="USR-SEC-01">Elena Rostova (Synthetic demo user — Lead Security Analyst)</option>
              <option value="USR-SEC-02">Marcus Chen (Synthetic demo user — Senior Systems Analyst)</option>
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Manager Review Notes & Guidance *
          </label>
          <textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder="Explain why this escalation was approved, rejected, or returned for further log analysis."
            rows={4}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            required
          />
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Deciding Manager: <strong className="text-slate-200">{currentUser.name}</strong></span>
          <span className="font-mono text-purple-400">Audit Log Guaranteed</span>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 text-xs font-semibold text-slate-950 bg-gradient-to-r from-purple-400 to-cyan-400 hover:from-purple-300 hover:to-cyan-300 disabled:opacity-50 rounded-xl transition-all shadow-md shadow-purple-950/40"
          >
            {submitting ? 'Recording Decision...' : 'Commit Managerial Decision'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
