# IncidentIQ — AI-Powered Incident Memory and Resolution Platform for IBM Z

**Team:** Zenvora  
**Tagline:** *Learn from every incident. Resolve the next one smarter.*  
**Target platform:** IBM LinuxONE, subject to deployment verification.

## Architecture

IncidentIQ keeps its existing React/Vite frontend, Express/TypeScript API, and SQLite database. The Express server is the primary full-stack application; its `/api/health` endpoint reports the actual Node platform and architecture. SQLite uses Node's built-in `node:sqlite` module, so there is no third-party SQLite native npm binding.

The default development database is `data/incidentiq.sqlite`. Set `INCIDENTIQ_DB_PATH` to a persistent location outside release directories in deployments. Startup performs additive schema migrations and does not delete or recreate an existing database. The optional Flask preview is not used by the LinuxONE deployment steps below.

Log evidence is imported from `data/Linux_2k.log_structured.csv`, the public LogHub Linux 2k dataset. It is demonstration/investigation evidence, not verified IBM Z production telemetry. The source provides `Month`, `Date`, and `Time`, but no year.

Similarity is a keyword-frequency cosine score, not TF-IDF or machine learning. A score describes textual similarity only; it does not prove an earlier fix will work. Stored investigation actions and outcomes are references for human review.

## Demo identities and access limitations

Elena Rostova, Marcus Chen, Alex Rivera, and the other built-in role-switcher accounts are synthetic demo users. The role switcher and backend assignment checks exercise workflows, but the app does not authenticate users. Do not expose it directly to the public Internet or treat these role checks as production authorization. Use a trusted SSH tunnel for demonstrations; add real authentication before public deployment.

The SQLite audit trail is an ordinary application database table. It is not immutable or tamper-proof. Seeded audit rows are labeled **Seeded demo data**. Reuse counts and independent verifiers are not recorded and therefore are not displayed as measured activity.

## Local development

Use Node.js 22.13.0 or newer. Bun is not required: this application uses `node:sqlite`, which was not available through the Bun runtime tested during preparation.

```powershell
npm ci
npm run dev
```

Open `http://localhost:3000`. For a production frontend bundle, run `npm run build`. In production the Express server serves the prebuilt `dist` directory and binds to `127.0.0.1` by default; set `HOST` only when a trusted network proxy or equivalent access control is in place.

## IBM LinuxONE deployment

### Verification status

The supplied VM details are `linux1@148.100.79.247`. Ubuntu 24.04.4 LTS and `s390x` were previously observed, but could not be verified during this preparation: SSH returned `Permission denied (publickey)`. Do not assume the OS, architecture, or a private-key filename. The commands below must start with live VM checks. Deployment and health checks have **not** been run on LinuxONE.

### 1. Verify access, OS, and architecture

From Windows PowerShell, replace the placeholder with the private-key path you have verified; no key filename is assumed:

```powershell
$SshKey = '<path-to-your-verified-private-key>'
ssh -i $SshKey -o IdentitiesOnly=yes linux1@148.100.79.247 'cat /etc/os-release; uname -m'
```

Continue with the Ubuntu commands below only if the live output confirms Ubuntu and `s390x`. Check that SSH access is authorized before transferring files.

### 2. Build and securely transfer the release from Windows

Run in the project directory. The Vite/Tailwind production frontend is built on the development machine because the Tailwind Oxide package does not publish a native Linux s390x binary. The deployed Express server runs on LinuxONE; its `dist` bundle is static browser content.

```powershell
npm ci
npm run build

$Archive = Join-Path $env:TEMP 'incidentiq-release.tar.gz'
tar.exe -czf $Archive --exclude='.env' --exclude='.env.*' --exclude='node_modules' --exclude='.git' --exclude='data/incidentiq.sqlite*' -C (Get-Location).Path .
tar.exe -tzf $Archive | Select-String '(^|/)(\.env|incidentiq\.sqlite|node_modules)(/|$)'
scp -i $SshKey -o IdentitiesOnly=yes $Archive linux1@148.100.79.247:/home/linux1/
```

The `Select-String` check should print no excluded secret, database, or dependency paths. The archive includes the frontend build and LogHub CSV, but excludes `.env` and all SQLite database/WAL files.

### 3. Install packages and Node.js on the verified Ubuntu s390x VM

```bash
sudo apt update
sudo apt install -y ca-certificates curl python3 sqlite3 tar xz-utils

# Select the latest Node.js 22 release with an official linux-s390x archive.
NODE_VERSION="$(python3 -c 'import json,urllib.request; releases=json.load(urllib.request.urlopen("https://nodejs.org/dist/index.json")); print(next(r["version"][1:] for r in releases if r["version"].startswith("v22.") and "linux-s390x" in r["files"]))')"
curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-s390x.tar.xz"
curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt"
grep "node-v${NODE_VERSION}-linux-s390x.tar.xz" SHASUMS256.txt | sha256sum -c -

sudo mkdir -p "/opt/node-v${NODE_VERSION}"
sudo tar -xJf "node-v${NODE_VERSION}-linux-s390x.tar.xz" -C "/opt/node-v${NODE_VERSION}" --strip-components=1
sudo ln -sfn "/opt/node-v${NODE_VERSION}" /opt/nodejs
export PATH="/opt/nodejs/bin:$PATH"
node --version
npm --version
uname -m
```

The application requires Node 22.13.0 or newer for its runtime/toolchain requirements. No Bun installation or SQLite development headers are needed. Node supplies `node:sqlite`; `tsx` uses esbuild, whose Linux s390x binary package is published. Build-only Vite/Tailwind dependencies are installed on the development machine, not on the server.

### 4. Install the release and configure persistent SQLite

Before choosing a database path, check whether this VM already has an IncidentIQ database:

```bash
sudo find /opt /var/lib /home/linux1 -type f -name incidentiq.sqlite -print 2>/dev/null
```

If an existing database is found, **keep it** and set `INCIDENTIQ_DB_PATH` to that path. Do not overwrite, delete, or reinitialize it. For a new VM with no existing database, if the current local incidents should be carried over, create a consistent SQLite backup from Windows and transfer it separately:

```powershell
$env:INCIDENTIQ_DB_SNAPSHOT = Join-Path $env:TEMP 'incidentiq-initial.sqlite'
python -c "import os,sqlite3; source=sqlite3.connect(r'data\incidentiq.sqlite'); target=sqlite3.connect(os.environ['INCIDENTIQ_DB_SNAPSHOT']); source.backup(target); target.close(); source.close()"
scp -i $SshKey -o IdentitiesOnly=yes $env:INCIDENTIQ_DB_SNAPSHOT linux1@148.100.79.247:/home/linux1/
```

Only on a new VM after confirming that no existing database is present:

```bash
sudo install -d -o linux1 -g linux1 -m 0750 /var/lib/incidentiq
if sudo test -e /var/lib/incidentiq/incidentiq.sqlite; then
  echo "Database already exists; leaving it untouched."
else
  sudo install -o linux1 -g linux1 -m 0640 /home/linux1/incidentiq-initial.sqlite /var/lib/incidentiq/incidentiq.sqlite
fi
```

Extract each release to its own directory. The stable database path remains outside it:

```bash
export PATH="/opt/nodejs/bin:$PATH"
RELEASE_ID="$(date -u +%Y%m%d%H%M%S)"
RELEASE="/opt/incidentiq/releases/${RELEASE_ID}"
sudo mkdir -p "$RELEASE"
sudo tar -xzf /home/linux1/incidentiq-release.tar.gz -C "$RELEASE"
sudo chown -R linux1:linux1 "$RELEASE"
cd "$RELEASE"
npm ci --omit=dev
sudo ln -sfn "$RELEASE" /opt/incidentiq/current
sudo install -d -o root -g root -m 0750 /etc/incidentiq
sudo install -m 0600 /dev/null /etc/incidentiq/incidentiq.env
sudoedit /etc/incidentiq/incidentiq.env
```

Set these values in the protected environment file. Add `GEMINI_API_KEY` there only if Gemini is intended; never put it in the frontend or release archive.

```text
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
INCIDENTIQ_DB_PATH=/var/lib/incidentiq/incidentiq.sqlite
# GEMINI_API_KEY=<configure privately on the server, if wanted>
```

### 5. Run as a persistent systemd service

This service uses the existing Express application, release directory, and persistent database path; it does not start a second API or database:

```bash
sudo tee /etc/systemd/system/incidentiq.service >/dev/null <<'EOF'
[Unit]
Description=IncidentIQ Express application
After=network.target

[Service]
Type=simple
User=linux1
Group=linux1
WorkingDirectory=/opt/incidentiq/current
EnvironmentFile=/etc/incidentiq/incidentiq.env
Environment=PATH=/opt/nodejs/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=/opt/nodejs/bin/node /opt/incidentiq/current/node_modules/tsx/dist/cli.mjs server.ts
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/incidentiq

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now incidentiq
sudo systemctl status incidentiq --no-pager
```

The production server binds to loopback by default. Keep port 3000 closed to public networks; for a demonstration, create an SSH tunnel from Windows:

```powershell
ssh -N -L 3000:127.0.0.1:3000 -i $SshKey -o IdentitiesOnly=yes linux1@148.100.79.247
```

Then open `http://localhost:3000` locally.

### 6. Verify, inspect logs, and recover

```powershell
ssh -i $SshKey -o IdentitiesOnly=yes linux1@148.100.79.247 'curl -fsS http://127.0.0.1:3000/api/health'
ssh -i $SshKey -o IdentitiesOnly=yes linux1@148.100.79.247 'curl -fsS "http://127.0.0.1:3000/api/logs?search=logrotate&limit=2"'
ssh -i $SshKey -o IdentitiesOnly=yes linux1@148.100.79.247 'sudo journalctl -u incidentiq -n 100 --no-pager'
```

The health JSON reports the running Node platform and architecture; require `linux` and `s390x` before describing the app as running on LinuxONE. To follow logs or restart after a failure:

```bash
sudo journalctl -u incidentiq -f
sudo systemctl restart incidentiq
sudo systemctl status incidentiq --no-pager
curl -fsS http://127.0.0.1:3000/api/health
```

For updates, build and transfer a new release as above, run `npm ci --omit=dev` in that release, switch `/opt/incidentiq/current`, and restart the same service. Do not include or replace `/var/lib/incidentiq/incidentiq.sqlite` in a release. Back up that database before upgrades; startup migrations are additive.

## Verification status and limitations

- Local Windows Node/npm, database, API, and frontend checks are performed during development; they do not establish LinuxONE compatibility or a remote deployment.
- The VM's OS and architecture, remote service start, s390x npm installation, API/frontend access, and persistence after a VM restart remain unverified until the SSH checks above succeed.
- Similarity is keyword-frequency cosine; AI status distinguishes successful response, configured failure, unverified configuration, and no key. Rule-based functionality remains available without Gemini.
- The built-in users are synthetic, unauthenticated demo identities. Public deployment requires real authentication and a security review.
