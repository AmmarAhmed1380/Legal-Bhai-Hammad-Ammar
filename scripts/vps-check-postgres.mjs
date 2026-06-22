import { NodeSSH } from "node-ssh";

const password = process.env.VPS_SSH_PASSWORD;
if (!password) {
  process.exit(1);
}

const ssh = new NodeSSH();
await ssh.connect({ host: "64.235.61.6", username: "Administrator", password, tryKeyboard: true });
const ps = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";

for (const label of [
  "Get-Service *postgres* | Format-Table Name,Status,DisplayName -AutoSize",
  "Get-Service | Where-Object { $_.DisplayName -like '*PostgreSQL*' } | Format-Table Name,Status,DisplayName -AutoSize",
  "netstat -an | findstr 5432",
]) {
  const result = await ssh.execCommand(`${ps} -NoProfile -Command "${label}"`);
  console.log(`--- ${label} ---`);
  console.log(result.stdout || result.stderr);
}

ssh.dispose();
