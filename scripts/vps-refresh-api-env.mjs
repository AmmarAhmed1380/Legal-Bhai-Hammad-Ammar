import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { NodeSSH } from "node-ssh";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const vpsRoot = process.env.VPS_ROOT ?? "C:/LegalBahi";
const vpsRootWin = vpsRoot.replace(/\//g, "\\");
const host = process.env.VPS_HOST ?? "64.235.61.6";
const username = process.env.VPS_USER ?? "Administrator";
const password = process.env.VPS_SSH_PASSWORD;

if (!password) {
  console.error("Set VPS_SSH_PASSWORD");
  process.exit(1);
}

const ssh = new NodeSSH();
ssh.connection?.on("error", () => {});
process.on("uncaughtException", (err) => {
  if (err?.code === "ECONNRESET") process.exit(0);
  throw err;
});

console.log(`Connecting to ${username}@${host} ...`);
await ssh.connect({ host, username, password, tryKeyboard: true });

const powershell = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const nssm = `${vpsRootWin}\\tools\\nssm.exe`;

async function run(label, command, { allowFail = false } = {}) {
  console.log(`\n=== ${label} ===`);
  const result = await ssh.execCommand(command);
  const out = (result.stdout || result.stderr || "").trim();
  if (out) console.log(out.slice(0, 5000));
  console.log(`exit: ${result.code}`);
  if (!allowFail && result.code !== 0) throw new Error(`${label} failed`);
  return result;
}

const localEnvFile = process.env.VPS_ENV_FILE ?? join(repoRoot, ".env.production");
if (!existsSync(localEnvFile)) {
  console.error(
    "No production env file to upload. Copy .env.production.example to .env.production locally, or set VPS_ENV_FILE.",
  );
  process.exit(1);
}

await ssh.putFile(localEnvFile, `${vpsRoot}/.env.production`);
await ssh.putFile(
  join(repoRoot, "infra/windows/install-services.ps1"),
  `${vpsRoot}/infra/windows/install-services.ps1`,
);
await ssh.putFile(
  join(repoRoot, "apps/api/src/lib/config.ts"),
  `${vpsRoot}/apps/api/src/lib/config.ts`,
);

await run(
  "Refresh NSSM env (no web rebuild)",
  `${powershell} -NoProfile -ExecutionPolicy Bypass -File ${vpsRootWin}\\infra\\windows\\install-services.ps1 -Root ${vpsRootWin} -EnvironmentFile ${vpsRootWin}\\.env.production`,
  { allowFail: true },
);

await run("Start API", `${nssm} start LegalBahiApi`, { allowFail: true });
await run("Start worker", `${nssm} start LegalBahiWorker`, { allowFail: true });

await run(
  "Health check",
  `${powershell} -NoProfile -Command "Start-Sleep -Seconds 10; Get-Service LegalBahiApi,LegalBahiWorker | Format-Table Name,Status -AutoSize; curl.exe -s -m 5 http://127.0.0.1:3001/health"`,
  { allowFail: true },
);

try {
  ssh.dispose();
} catch {}
console.log("\nEnv refresh complete.");
