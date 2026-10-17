import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { User } from '../../types';
import { api } from '../../services/api';
import { CheckCircle2, XCircle, Clock, HelpCircle, AlertCircle } from 'lucide-react';

interface RecordActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidentId: string | null;
  currentUser: User;
  onActionRecorded: () => void;
}

export const RecordActionModal: React.FC<RecordActionModalProps> = ({
  isOpen,
  onClose,
  incidentId,
  currentUser,
  onActionRecorded
}) => {
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<'In Progress' | 'Successful' | 'Failed' | 'Inconclusive'>('Successful');
  const [notes, setNotes] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [followUpAction, setFollowUpAction] = useState('');
  const [evidenceLines, setEvidenceLines] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!incidentId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please provide an action description.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Parse line IDs if provided (e.g. 4, 5, 20)
      const parsedRefs = evidenceLines
        .split(/[,\s]+/)
        .map(n => parseInt(n.trim(), 10))
        .filter(n => !isNaN(n));

      await api.recordAction(incidentId, {
        description: description.trim(),
        result,
        notes: notes.trim(),
        evidence_refs: parsedRefs,
        follow_up_action: followUpAction.trim(),
        failure_reason: result === 'Failed' ? failureReason.trim() : undefined,
        user_id: currentUser.id,
        user_name: currentUser.name,
        user_role: currentUser.role
      });

      onActionRecorded();
      onClose();
      // Reset
      setDescription('');
      setNotes('');
      setFailureReason('');
      setFollowUpAction('');
      setEvidenceLines('');
    } catch (err: any) {
      setError(err.message || 'Failed to record action');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Record Investigation Action (${incidentId})`}
      subtitle="Preserve investigation steps and outcome results to build reusable enterprise incident memory"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Action Description *
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Applied iptables rate-limit on port 22 / inspected /var/tmp replay cache"
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-2">
            Action Outcome / Result *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setResult('Successful')}
              className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                result === 'Successful'
                  ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Successful</span>
            </button>

            <button
              type="button"
              onClick={() => setResult('Failed')}
              className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                result === 'Failed'
                  ? 'bg-rose-950/70 border-rose-500 text-rose-200'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Failed</span>
            </button>

            <button
              type="button"
              onClick={() => setResult('In Progress')}
              className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                result === 'In Progress'
                  ? 'bg-cyan-950/70 border-cyan-500 text-cyan-200'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>In Progress</span>
            </button>

            <button
              type="button"
              onClick={() => setResult('Inconclusive')}
              className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                result === 'Inconclusive'
                  ? 'bg-slate-800 border-slate-600 text-slate-200'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>Inconclusive</span>
            </button>
          </div>
        </div>

        {/* If Failed: Require Root Cause Explanation to prevent repetition */}
        {result === 'Failed' && (
          <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/60 space-y-2">
            <label className="block text-xs font-semibold text-rose-300">
              Why did this action fail? (Failure Root Cause) *
            </label>
            <textarea
              value={failureReason}
              onChange={(e) => setFailureReason(e.target.value)}
              placeholder="e.g., Process restart did not drop existing TCP socket queue; attacking host flooded immediately."
              rows={2}
              className="w-full bg-slate-900 border border-rose-800/80 rounded-xl p-2.5 text-xs text-rose-100 placeholder-rose-400/50 focus:outline-none focus:ring-1 focus:ring-rose-500"
              required
            />
            <p className="text-[11px] text-rose-300/80">
              This failure rationale will be preserved in Incident Memory so subsequent analysts are cautioned against repeating this step.
            </p>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Investigation Observation & Technical Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Record commands executed, configuration files altered, or system response observed."
            rows={3}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Referenced Log Line Numbers (Optional)
            </label>
            <input
              type="text"
              value={evidenceLines}
              onChange={(e) => setEvidenceLines(e.target.value)}
              placeholder="e.g., 4, 5, 20, 22"
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Planned Next Step / Follow-up Action
            </label>
            <input
              type="text"
              value={followUpAction}
              onChange={(e) => setFollowUpAction(e.target.value)}
              placeholder="e.g., Verify 24h cron execution / inspect pam audit"
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
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
            className="px-5 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 rounded-xl transition-all shadow-md shadow-cyan-950/40"
          >
            {submitting ? 'Recording...' : 'Save Action to Timeline'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
