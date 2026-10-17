import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { User, SimilarityMatch } from '../../types';
import { api } from '../../services/api';
import { Sparkles, AlertCircle, ArrowRight, Check } from 'lucide-react';

interface RegisterIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onIncidentCreated: (newIncidentId: string) => void;
}

export const RegisterIncidentModal: React.FC<RegisterIncidentModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onIncidentCreated
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [affectedSystem, setAffectedSystem] = useState('z/VM Linux Guest 01 (LPAR-PROD-WEB)');
  const [severity, setSeverity] = useState('Medium');
  const [category, setCategory] = useState('Security / Authentication');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live Similar Incidents Matching
  const [similarMatches, setSimilarMatches] = useState<SimilarityMatch[]>([]);
  const [checkingSimilarity, setCheckingSimilarity] = useState(false);

  useEffect(() => {
    if (!title && !description) {
      setSimilarMatches([]);
      return;
    }

    const timer = setTimeout(() => {
      if (title.length > 5 || description.length > 10) {
        setCheckingSimilarity(true);
        api.searchSimilarity({ title, description, category })
          .then(res => setSimilarMatches(res.matches.slice(0, 2)))
          .catch(console.error)
          .finally(() => setCheckingSimilarity(false));
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [title, description, category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Please provide both incident title and detailed symptom description.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await api.createIncident({
        title: title.trim(),
        description: description.trim(),
        affected_system: affectedSystem,
        severity,
        category,
        reporter_id: currentUser.id,
        reporter_name: currentUser.name
      });

      onIncidentCreated(res.incident.id);
      onClose();
      // Reset form
      setTitle('');
      setDescription('');
    } catch (err: any) {
      setError(err.message || 'Failed to register incident');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Register New Enterprise Incident"
      subtitle="Report observed anomalies on IBM Z or LinuxONE partitions for automated evidence matching"
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
            Incident Title / Symptom Headline *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Multiple sshd PAM authentication failures targeting root"
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Detailed Observed Symptoms & Error Messages *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what occurred, any error codes (e.g., ALERT exited abnormally with [1], check pass; user unknown), and affected services."
            rows={4}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Affected System / LPAR *
            </label>
            <select
              value={affectedSystem}
              onChange={(e) => setAffectedSystem(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
            >
              <option value="z/VM Linux Guest 01 (LPAR-PROD-WEB)">z/VM Linux Guest 01 (LPAR-PROD-WEB)</option>
              <option value="IBM Z Enterprise Syslog Partition (LPAR-OPS-LOGS)">IBM Z Syslog Partition (LPAR-OPS-LOGS)</option>
              <option value="IBM Z Core Transaction Gateway (LPAR-FIN-CORE)">IBM Z Core Transaction Gateway (LPAR-FIN-CORE)</option>
              <option value="LinuxONE File Transfer Gateway (LPAR-EXT-FTP)">LinuxONE File Transfer Gateway (LPAR-EXT-FTP)</option>
              <option value="z/OS CICS Workload Router (LPAR-TX-ROUTER)">z/OS CICS Workload Router (LPAR-TX-ROUTER)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Initial Severity *
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
            >
              <option value="Low">Low - Informational / Routine</option>
              <option value="Medium">Medium - Degraded component</option>
              <option value="High">High - Critical workload threat</option>
              <option value="Critical">Critical - Production outage</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Incident Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
            >
              <option value="Security / Authentication">Security / Authentication</option>
              <option value="System Daemon / Storage">System Daemon / Storage</option>
              <option value="Network / Perimeter">Network / Perimeter</option>
              <option value="Hardware / Firmware">Hardware / Firmware</option>
              <option value="Application Runtime">Application Runtime</option>
            </select>
          </div>
        </div>

        {/* Live Similarity Detection Card */}
        {similarMatches.length > 0 && (
          <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-800/60 space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>IncidentIQ Memory Detection: Similar Past Incident Identified</span>
            </div>
            <div className="space-y-1.5">
              {similarMatches.map(m => (
                <div key={m.incident_id} className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono text-cyan-400 font-semibold">{m.incident_id}</span>: {m.title}
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Status: {m.status} · Outcome: {m.outcome_type} · Matching: {m.matching_terms.join(', ')}
                    </div>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 text-xs">
                    {m.similarity_percentage}% Match
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reporter info */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Reporting as: <strong className="text-slate-200">{currentUser.name}</strong> ({currentUser.role.toUpperCase()})</span>
          <span className="font-mono text-slate-400">Server Authorization Enforced</span>
        </div>

        {/* Modal Buttons */}
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
            {submitting ? 'Registering...' : 'Register Incident in Memory'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
