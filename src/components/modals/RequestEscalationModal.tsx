import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { User } from '../../types';
import { api } from '../../services/api';
import { ArrowUpRight, AlertCircle, ShieldAlert } from 'lucide-react';

interface RequestEscalationModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidentId: string | null;
  currentUser: User;
  onEscalationSubmitted: () => void;
}

export const RequestEscalationModal: React.FC<RequestEscalationModalProps> = ({
  isOpen,
  onClose,
  incidentId,
  currentUser,
  onEscalationSubmitted
}) => {
  const [reason, setReason] = useState('');
  const [supportingDetails, setSupportingDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!incidentId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a specific escalation justification.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await api.requestEscalation(incidentId, {
        reason: reason.trim(),
        supporting_details: supportingDetails.trim(),
        user_id: currentUser.id,
        user_name: currentUser.name,
        user_role: currentUser.role
      });

      onEscalationSubmitted();
      onClose();
      setReason('');
      setSupportingDetails('');
    } catch (err: any) {
      setError(err.message || 'Failed to submit escalation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Request Human Escalation (${incidentId})`}
      subtitle="Submit this incident to the Incident Manager Escalation Queue with technical justification"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/50 text-xs text-amber-200 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-300">Human-Reviewed Escalation Governance</strong>
            <p className="text-[11px] text-amber-200/80 mt-0.5">
              Escalation transfers this incident to the Manager's priority queue. Analysts cannot self-approve escalations. Managers review recorded logs and actions before rendering an approval, rejection, or return.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Escalation Justification & Core Challenge *
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Cross-LPAR Kerberos token desync requires z/OS Sysplex coordination"
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Supporting Investigation Details & What Has Been Attempted
          </label>
          <textarea
            value={supportingDetails}
            onChange={(e) => setSupportingDetails(e.target.value)}
            placeholder="Summarize actions attempted, why current authorization is insufficient, and what specialized resources or approvals are required."
            rows={4}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
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
            className="px-5 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-xl transition-all shadow-md shadow-amber-950/40 flex items-center gap-1.5"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>{submitting ? 'Submitting...' : 'Submit to Escalation Queue'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
