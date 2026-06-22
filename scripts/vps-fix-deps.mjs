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
const log = `${root}\\logs\\npm-ci-fix.log`;

async function run(label, command, { allowFail = false } = {}) {
  console.log(`\n=== ${label} ===`);
  const result = await ssh.execCommand(command);
  const out = (result.stdout || result.stderr || "").trim();
  if (out) console.log(out.slice(0, 4000));
  console.log(`exit: ${result.code}`);
  if (!allowFail && result.code !== 0) throw new Error(`${label} failed`);
  return result;
}

await run("Stop API/worker", `${nssm} stop LegalBahiApi`, { allowFail: true });
await run("Stop worker", `${nssm} stop LegalBahiWorker`, { allowFail: true });
await run(
  "Kill stuck npm/node installers (keep web)",
  `${ps} -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='node.exe'\\" | Where-Object { $_.CommandLine -match 'npm' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`,
  { allowFail: true },
);

await run(
  "Clean install",
  `${ps} -NoProfile -Command "$ErrorActionPreference='Continue'; Set-Location '${root}'; Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue; npm ci *> '${log}' 2>&1; if ($LASTEXITCODE -ne 0) { Get-Content '${log}' -Tail 40; exit $LASTEXITCODE }; Write-Output 'npm ci OK'; if (Test-Path node_modules\\@sentry\\node) { 'sentry: OK' } else { 'sentry: MISSING'; exit 1 }; if (Test-Path node_modules\\tsx) { 'tsx: OK' } else { 'tsx: MISSING'; exit 1 }"`,
);

await run("Start API", `${nssm} start LegalBahiApi`);
await run("Start worker", `${nssm} start LegalBahiWorker`);

await run(
  "Health check",
  `${ps} -NoProfile -Command "Start-Sleep -Seconds 12; Get-Service LegalBahiApi,LegalBahiWorker | Format-Table Name,Status -AutoSize; curl.exe -s http://127.0.0.1:3001/health; if (-not (Get-Content '${root}\\logs\\LegalBahiApi.stderr.log' -Tail 5 -ErrorAction SilentlyContinue)) { }"`,
  { allowFail: true },
);

try { ssh.dispose(); } catch {}
console.log("\nFix complete.");
