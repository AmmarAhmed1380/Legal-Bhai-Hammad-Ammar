import { NodeSSH } from "node-ssh";

const password = process.env.VPS_SSH_PASSWORD;
if (!password) {
  console.error("VPS_SSH_PASSWORD required");
  process.exit(1);
}

const ssh = new NodeSSH();
await ssh.connect({ host: "64.235.61.6", username: "Administrator", password, tryKeyboard: true });
const ps = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";

const checks = [
  "Get-Process node,npm -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,CPU,StartTime | Format-Table -AutoSize",
  "Get-Service LegalBahiApi,LegalBahiWorker,LegalBahiWeb,LegalBahiPostgres,caddy -ErrorAction SilentlyContinue | Format-Table Name,Status -AutoSize",
  "netstat -an | findstr \"3000 3001 5432\"",
  "if (Test-Path C:\\LegalBahi\\node_modules\\sanitize-html) { 'sanitize-html: OK' } else { 'sanitize-html: MISSING' }",
  "if (Test-Path C:\\LegalBahi\\node_modules\\axios) { 'axios: OK' } else { 'axios: MISSING' }",
  "Get-Content C:\\LegalBahi\\logs\\LegalBahiApi.stderr.log -Tail 15 -ErrorAction SilentlyContinue",
  "curl.exe -s -o NUL -w \"local-health:%{http_code}\" http://127.0.0.1:3001/health",
];

for (const command of checks) {
  const result = await ssh.execCommand(`${ps} -NoProfile -Command "${command}"`);
  console.log(`\n>>> ${command.slice(0, 70)}`);
  console.log((result.stdout || result.stderr || "(empty)").trim());
}

ssh.dispose();
