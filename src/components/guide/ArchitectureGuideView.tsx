import React, { useState } from 'react';
import { Terminal, Cpu, Server, Database, Shield, BookOpen, Check, Copy } from 'lucide-react';

export const ArchitectureGuideView: React.FC = () => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const linuxOneCommands = `# Verify SSH access, OS, and architecture; key path is user-supplied
$SshKey = '<path-to-your-verified-private-key>'
ssh -i $SshKey -o IdentitiesOnly=yes linux1@148.100.79.247 'cat /etc/os-release; uname -m'

# Windows: build the frontend and transfer a release (no .env or database)
npm ci
npm run build
$Archive = Join-Path $env:TEMP 'incidentiq-release.tar.gz'
tar.exe -czf $Archive --exclude='.env' --exclude='.env.*' --exclude='node_modules' --exclude='.git' --exclude='data/incidentiq.sqlite*' -C (Get-Location).Path .
scp -i $SshKey -o IdentitiesOnly=yes $Archive linux1@148.100.79.247:/home/linux1/

# Confirm Ubuntu s390x first, then install system tools and official Node 22
sudo apt update
sudo apt install -y ca-certificates curl python3 sqlite3 tar xz-utils
NODE_VERSION="$(python3 -c 'import json,urllib.request; d=json.load(urllib.request.urlopen(\"https://nodejs.org/dist/index.json\")); print(next(r[\"version\"][1:] for r in d if r[\"version\"].startswith(\"v22.\") and \"linux-s390x\" in r[\"files\"]))')"
curl -fsSLO \"https://nodejs.org/dist/v\${NODE_VERSION}/node-v\${NODE_VERSION}-linux-s390x.tar.xz\"
curl -fsSLO \"https://nodejs.org/dist/v\${NODE_VERSION}/SHASUMS256.txt\"
grep \"node-v\${NODE_VERSION}-linux-s390x.tar.xz\" SHASUMS256.txt | sha256sum -c -

# Install in a versioned directory; keep the SQLite database outside releases
export PATH=\"/opt/nodejs/bin:\$PATH\"
RELEASE=\"/opt/incidentiq/releases/\$(date -u +%Y%m%d%H%M%S)\"
sudo mkdir -p \"\$RELEASE\"
sudo tar -xzf /home/linux1/incidentiq-release.tar.gz -C \"\$RELEASE\"
cd \"\$RELEASE\"
npm ci --omit=dev
sudo ln -sfn \"\$RELEASE\" /opt/incidentiq/current
# Configure /etc/incidentiq/incidentiq.env with NODE_ENV, HOST=127.0.0.1,
# PORT=3000, and INCIDENTIQ_DB_PATH=/var/lib/incidentiq/incidentiq.sqlite.
# Store an optional Gemini credential only in that protected server-side file.

# Verify and recover
curl -fsS http://127.0.0.1:3000/api/health
sudo journalctl -u incidentiq -n 100 --no-pager
sudo systemctl restart incidentiq`;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-xl font-bold text-slate-100 tracking-tight">
          IBM LinuxONE Architecture & Deployment Manual
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Deployment commands and compatibility notes. The VM and LinuxONE deployment have not yet been verified.
        </p>
      </div>

      {/* Target Platform Specification */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-1">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold">
            <Cpu className="w-4 h-4" />
            <span>ARCHITECTURE</span>
          </div>
          <h3 className="text-base font-bold text-slate-100">LinuxONE / s390x target</h3>
          <p className="text-xs text-slate-400">
            Confirm the running VM architecture with <code>uname -m</code> before deployment; remote verification is pending.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-1">
          <div className="flex items-center gap-2 text-purple-400 text-xs font-mono font-bold">
            <Server className="w-4 h-4" />
            <span>OPERATING SYSTEM</span>
          </div>
          <h3 className="text-base font-bold text-slate-100">OS not yet verified</h3>
          <p className="text-xs text-slate-400">
            Ubuntu 24.04.4 was previously observed but could not be confirmed through SSH.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-1">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-bold">
            <Database className="w-4 h-4" />
            <span>DATABASE</span>
          </div>
          <h3 className="text-base font-bold text-slate-100">SQLite via node:sqlite</h3>
          <p className="text-xs text-slate-400">
            Node's built-in SQLite API; set INCIDENTIQ_DB_PATH outside release directories to persist data.
          </p>
        </div>
      </div>

      {/* LinuxONE Community Cloud Deployment Commands */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-100">LinuxONE Deployment Preparation (not yet executed remotely)</h3>
          </div>
          <button
            onClick={() => copyToClipboard(linuxOneCommands, 'linuxone')}
            className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-100 rounded bg-slate-900 border border-slate-700 flex items-center gap-1"
          >
            {copiedSection === 'linuxone' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copiedSection === 'linuxone' ? 'Copied' : 'Copy Bash Script'}</span>
          </button>
        </div>

        <pre className="p-4 rounded-xl bg-slate-950 border border-slate-900 font-mono text-xs text-cyan-300 overflow-x-auto leading-relaxed select-all">
          {linuxOneCommands}
        </pre>
      </div>

      {/* Dataset & Testing Verification Section */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 space-y-3 text-xs text-slate-300 leading-relaxed">
        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <span>Demonstration Transparency & Public Benchmark Dataset Disclaimer</span>
        </h3>
        <p>
          IncidentIQ identifies the telemetry source as the public <strong>LogHub Linux 2k structured dataset</strong> (<code className="text-cyan-300 font-mono">Linux_2k.log_structured.csv</code>). It is demonstration and investigation evidence, not verified IBM Z production logs. The supplied CSV has month/day/time fields but no year.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
            <span className="font-semibold text-slate-200">Demonstration-Grade Features:</span>
            <ul className="list-disc pl-4 text-slate-400 space-y-0.5">
              <li>Role switcher for testing Analyst, Manager, and Reporter workflows without external OAuth redirect barriers</li>
              <li>Seeded demo incidents and audit rows are distinguished from recorded activity</li>
              <li>Deployment SQLite database is kept outside versioned releases</li>
            </ul>
          </div>

          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1">
            <span className="font-semibold text-slate-200">Current Implementation Notes:</span>
            <ul className="list-disc pl-4 text-slate-400 space-y-0.5">
              <li>Server-side authorization enforcement (reporters cannot approve escalations or resolve incidents)</li>
              <li>Keyword-frequency cosine similarity (not TF-IDF or machine learning)</li>
              <li>SQLite Audit Trail (not tamper-proof)</li>
              <li>Rule-based fallback; Gemini is marked available only after a successful response</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
