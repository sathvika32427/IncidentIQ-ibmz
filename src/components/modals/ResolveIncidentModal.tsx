import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { User } from '../../types';
import { api } from '../../services/api';
import { CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';

interface ResolveIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidentId: string | null;
  currentUser: User;
  onIncidentResolved: () => void;
}

export const ResolveIncidentModal: React.FC<ResolveIncidentModalProps> = ({
  isOpen,
  onClose,
  incidentId,
  currentUser,
  onIncidentResolved
}) => {
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [resolutionEvidence, setResolutionEvidence] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<'Verified' | 'Unverified' | 'Incomplete'>('Verified');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!incidentId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionSummary.trim()) {
      setError('Please provide the confirmed resolution procedure summary.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await api.resolveIncident(incidentId, {
        resolution_summary: resolutionSummary.trim(),
        resolution_evidence: resolutionEvidence.trim() || 'Validated by assigned security analyst.',
        verification_status: verificationStatus,
        user_id: currentUser.id,
        user_name: currentUser.name,
        user_role: currentUser.role
      });

      onIncidentResolved();
      onClose();
      setResolutionSummary('');
      setResolutionEvidence('');
    } catch (err: any) {
      setError(err.message || 'Failed to resolve incident');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Mark Incident Resolved (${incidentId})`}
      subtitle="Save verified fix procedure to IncidentIQ Memory so other analysts can reuse this solution"
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
            Confirmed Resolution Summary & Remediating Actions *
          </label>
          <textarea
            value={resolutionSummary}
            onChange={(e) => setResolutionSummary(e.target.value)}
            placeholder="Document what actions succeeded in resolving this issue (e.g., Applied iptables drop rule, rotated PAM secrets, verified no unauthorized root sessions)."
            rows={4}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Observed Resolution Evidence *
          </label>
          <textarea
            value={resolutionEvidence}
            onChange={(e) => setResolutionEvidence(e.target.value)}
            placeholder="What logs, telemetry, or diagnostic tests confirm the fix worked? (e.g., Zero subsequent authentication failures for 120 minutes, logrotate exited with 0)."
            rows={3}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Procedure Verification Level *
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setVerificationStatus('Verified')}
              className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                verificationStatus === 'Verified'
                  ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Verified Fix</span>
            </button>

            <button
              type="button"
              onClick={() => setVerificationStatus('Unverified')}
              className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                verificationStatus === 'Unverified'
                  ? 'bg-amber-950/70 border-amber-500 text-amber-200'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Unverified Claim</span>
            </button>

            <button
              type="button"
              onClick={() => setVerificationStatus('Incomplete')}
              className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                verificationStatus === 'Incomplete'
                  ? 'bg-slate-800 border-slate-600 text-slate-200'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}
            >
              <span>Workaround Only</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Only a Verified outcome moves the incident to Resolved. Unverified or incomplete attempts are saved to Incident Memory while the incident remains unresolved.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
          <span>Confirmation: <strong className="text-slate-200">{currentUser.name}</strong></span>
          <span className="font-mono text-cyan-400">
            {verificationStatus === 'Verified' ? 'Resolution Clock Stopped' : 'Incident Remains Unresolved'}
          </span>
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
            className="px-5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded-xl transition-all shadow-md shadow-emerald-950/40"
          >
            {submitting ? 'Saving...' : verificationStatus === 'Verified' ? 'Confirm & Resolve' : 'Save Attempt (Remains Unresolved)'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
