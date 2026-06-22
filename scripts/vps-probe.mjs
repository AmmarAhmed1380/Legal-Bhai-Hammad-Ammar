import { NodeSSH } from "node-ssh";

const password = process.env.VPS_SSH_PASSWORD;
const ssh = new NodeSSH();
await ssh.connect({ host: "64.235.61.6", username: "Administrator", password, tryKeyboard: true });
const ps = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const root = "C:\\LegalBahi";

const commands = [
  `Get-Content '${root}\\logs\\LegalBahiApi.stderr.log' -Tail 60 -ErrorAction SilentlyContinue`,
  `Get-Content '${root}\\logs\\LegalBahiWorker.stderr.log' -Tail 60 -ErrorAction SilentlyContinue`,
  `Restart-Service LegalBahiApi, LegalBahiWorker -Force; Start-Sleep -Seconds 5; Get-Service LegalBahiApi,LegalBahiWorker | Format-Table Name,Status -AutoSize`,
  `curl.exe -s http://127.0.0.1:3001/health`,
];

for (const command of commands) {
  const result = await ssh.execCommand(`${ps} -NoProfile -Command "${command}"`);
  console.log(`>>> ${command.split(";")[0].slice(0,80)}...`);
  console.log((result.stdout || result.stderr || "(empty)").trim());
  console.log(`exit: ${result.code}`);
  console.log("");
}

try { ssh.dispose(); } catch {}
