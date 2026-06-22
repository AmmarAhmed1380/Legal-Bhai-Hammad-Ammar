import { NodeSSH } from "node-ssh";

const password = process.env.VPS_SSH_PASSWORD;
const ssh = new NodeSSH();
await ssh.connect({ host: "64.235.61.6", username: "Administrator", password, tryKeyboard: true });
const ps = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const bin = "C:\\LegalBahi\\postgresql_local\\pgsql\\bin";

const commands = [
  `Get-Service LegalBahiApi,LegalBahiWorker,LegalBahiWeb,LegalBahiPostgres,caddy | Format-Table Name,Status -AutoSize`,
  `& '${bin}\\psql.exe' -U postgres -h 127.0.0.1 -d legalbahi -tAc \"SELECT (SELECT COUNT(*) FROM firms) AS firms, (SELECT COUNT(*) FROM matters) AS matters, (SELECT COUNT(*) FROM documents) AS documents\"`,
];

for (const command of commands) {
  const result = await ssh.execCommand(`${ps} -NoProfile -Command "${command}"`);
  console.log((result.stdout || result.stderr || "").trim());
}

try { ssh.dispose(); } catch {}
