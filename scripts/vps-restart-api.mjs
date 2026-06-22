import { NodeSSH } from "node-ssh";

const password = process.env.VPS_SSH_PASSWORD;
if (!password) {
  console.error("Set VPS_SSH_PASSWORD");
  process.exit(1);
}

const ssh = new NodeSSH();
ssh.connection?.on?.("error", () => {});
process.on("uncaughtException", (err) => {
  if (err?.code === "ECONNRESET") process.exit(0);
  throw err;
});
await ssh.connect({ host: "64.235.61.6", username: "Administrator", password, tryKeyboard: true });
const ps = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const root = "C:\\LegalBahi";
const nssm = `${root}\\tools\\nssm.exe`;

async function run(label, command) {
  console.log(`\n=== ${label} ===`);
  const result = await ssh.execCommand(command);
  const out = (result.stdout || result.stderr || "").trim();
  if (out) console.log(out);
  console.log(`exit: ${result.code}`);
  return result;
}

await run(
  "Verify key deps",
  `${ps} -NoProfile -Command "Set-Location '${root}'; @('@sentry/node','tsx','sanitize-html','axios') | ForEach-Object { $p = Join-Path node_modules $_; if (Test-Path $p) { $_ + ': OK' } else { $_ + ': MISSING'; exit 1 } }"`,
);
await run("Start API via NSSM", `${nssm} start LegalBahiApi`);
await run("Start worker via NSSM", `${nssm} start LegalBahiWorker`);
await run("Wait and check services", `${ps} -NoProfile -Command "Start-Sleep -Seconds 8; Get-Service LegalBahiApi,LegalBahiWorker | Format-Table Name,Status -AutoSize"`);
await run("Check port 3001", `${ps} -NoProfile -Command "netstat -an | Select-String ':3001'"`);
await run("Local API health", `curl.exe -s http://127.0.0.1:3001/health`);
await run("API stderr tail", `${ps} -NoProfile -Command "Get-Content '${root}\\logs\\LegalBahiApi.stderr.log' -Tail 20 -ErrorAction SilentlyContinue"`);

try { ssh.dispose(); } catch {}
