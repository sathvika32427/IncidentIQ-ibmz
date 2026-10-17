import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { PlayCircle, ChevronRight, ChevronLeft, ArrowRight, CheckCircle2, Shield, Sparkles, Terminal } from 'lucide-react';

interface GuidedDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
  onSelectIncident: (id: string) => void;
}

const DEMO_STEPS = [
  {
    step: 1,
    title: 'Step 1: Employee Reports Login Anomalies',
    targetTab: 'incidents',
    role: 'Employee / Reporter',
    description: 'An employee notices authentication stalls on the z/VM Linux Guest. They submit an incident report with symptoms "Multiple sshd authentication failures targeting root" on system "z/VM Linux Guest 01 (LPAR-PROD-WEB)".',
    actionText: 'Open Incident Directory'
  },
  {
    step: 2,
    title: 'Step 2: Log Evidence Search & Extraction',
    targetTab: 'logs',
    role: 'Security Analyst',
    description: 'IncidentIQ navigates to the Log Explorer. Telemetry from the 2,000-line LogHub Linux benchmark is queried for sshd(pam_unix). Lines 4-13 show repeated root attempts from external subnet 220-135-151-1.hinet-ip.hinet.net.',
    actionText: 'Explore Log Evidence'
  },
  {
    step: 3,
    title: 'Step 3: Instant TF-IDF Similar Memory Search',
    targetTab: 'similarity',
    role: 'IncidentIQ Platform',
    description: 'The keyword-frequency cosine search compares symptoms with stored incidents and displays the computed percentage and Low/Moderate/High band. INC-Z-1042 is seeded demo data; review its recorded actions and outcomes rather than assuming its fix applies.',
    actionText: 'Run Similar Incident Search'
  },
  {
    step: 4,
    title: 'Step 4: Analyst Investigates & Records Action',
    targetTab: 'actions',
    role: 'Security Analyst',
    description: 'Analyst Elena Rostova records investigation actions. An initial attempt (reloading the sshd daemon) failed because open connection sockets were not dropped at the network boundary.',
    actionText: 'View Investigation Timeline'
  },
  {
    step: 5,
    title: 'Step 5: Outcome Recording (Capturing Failure Lessons)',
    targetTab: 'incidents',
    role: 'Security Analyst',
    description: 'The analyst explicitly documents the failed daemon reload and its root cause ("Process reload cannot drop TCP state"). IncidentIQ preserves this negative knowledge to safeguard future analysts.',
    actionText: 'Inspect Incident Details'
  },
  {
    step: 6,
    title: 'Step 6: Technical Escalation Request',
    targetTab: 'incidents',
    role: 'Security Analyst',
    description: 'When an incident exceeds single-partition permissions (e.g., Kerberos token cache conflict in INC-Z-1105), the analyst requests Human Escalation with technical supporting justification.',
    actionText: 'View Escalation Request'
  },
  {
    step: 7,
    title: 'Step 7: Manager Evaluates Escalation Queue',
    targetTab: 'escalations',
    role: 'Incident Manager',
    description: 'Incident Manager Sarah Vance opens the dedicated Escalation Queue, reviews attached log evidence and analyst attempt notes, and chooses whether to Approve, Return, or Reject.',
    actionText: 'Open Manager Escalation Queue'
  },
  {
    step: 8,
    title: 'Step 8: System Updates & Role Notifications',
    targetTab: 'overview',
    role: 'Notification Engine',
    description: 'Upon manager approval, the incident is reassigned, status transitions to Escalated, and real-time notifications are delivered to the team notification bell.',
    actionText: 'Check Overview Dashboard'
  },
  {
    step: 9,
    title: 'Step 9: Audit Trail',
    targetTab: 'audit',
    role: 'Audit Engine',
    description: 'Recorded audit events are stored in SQLite. Seeded rows are labeled as demo data; the database does not provide immutable or tamper-proof logging.',
    actionText: 'View Audit Trail'
  },
  {
    step: 10,
    title: 'Step 10: Reusable Incident Memory in Knowledge Base',
    targetTab: 'knowledge',
    role: 'Incident Memory Bank',
    description: 'Stored procedures and recorded outcomes are available as references. Reuse events and independent verifier identities are not recorded; review relevance before applying a procedure.',
    actionText: 'Open Reusable Knowledge Base'
  }
];

export const GuidedDemoModal: React.FC<GuidedDemoModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onSelectIncident
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  if (!isOpen) return null;

  const current = DEMO_STEPS[currentStepIndex];

  const handleJump = () => {
    onNavigateTab(current.targetTab);
    if (current.step === 4 || current.step === 5) {
      onSelectIncident('INC-Z-1042');
    } else if (current.step === 6) {
      onSelectIncident('INC-Z-1105');
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="IncidentIQ Interactive Demonstration Guide"
      subtitle="Step-by-step walkthrough of the outcome-aware incident memory lifecycle on IBM Z"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Progress Tracker */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>DEMONSTRATION PROGRESS</span>
            <span className="text-cyan-400 font-bold">{currentStepIndex + 1} of {DEMO_STEPS.length}</span>
          </div>
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full transition-all duration-300"
              style={{ width: `${((currentStepIndex + 1) / DEMO_STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-[#0e172a] border border-cyan-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 uppercase font-semibold">
              {current.role}
            </span>
            <span className="text-xs font-mono text-slate-500">Lifecycle Step {current.step}</span>
          </div>

          <h3 className="text-lg font-bold text-slate-100">{current.title}</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {current.description}
          </p>

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Target Workspace: <strong className="text-slate-200 uppercase">{current.targetTab}</strong></span>
            <button
              onClick={handleJump}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition-all shadow-md shadow-cyan-950/40 flex items-center gap-1.5"
            >
              <span>{current.actionText}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Step Navigation Buttons */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
            disabled={currentStepIndex === 0}
            className="px-3 py-1.5 text-xs text-slate-300 hover:text-slate-100 bg-slate-900 border border-slate-800 rounded-xl disabled:opacity-40 transition-colors flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-1">
            {DEMO_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStepIndex(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i === currentStepIndex ? 'bg-cyan-400 w-6' : 'bg-slate-700 hover:bg-slate-500'
                }`}
                aria-label={`Jump to step ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={() => {
              if (currentStepIndex === DEMO_STEPS.length - 1) {
                onClose();
              } else {
                setCurrentStepIndex(currentStepIndex + 1);
              }
            }}
            className="px-4 py-1.5 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors flex items-center gap-1"
          >
            <span>{currentStepIndex === DEMO_STEPS.length - 1 ? 'Finish Tour' : 'Next Step'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Modal>
  );
};
