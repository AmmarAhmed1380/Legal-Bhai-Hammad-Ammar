import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { NodeSSH } from "node-ssh";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const password = process.env.VPS_SSH_PASSWORD;
const ssh = new NodeSSH();
await ssh.connect({ host: "64.235.61.6", username: "Administrator", password, tryKeyboard: true });
const ps = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const root = "C:\\LegalBahi";

async function run(label, command) {
  console.log(`\n=== ${label} ===`);
  const result = await ssh.execCommand(command);
  const out = (result.stdout || result.stderr || "").trim();
  if (out) console.log(out);
  if (result.code !== 0) {
    throw new Error(`${label} failed (exit ${result.code})`);
  }
}

// Upload only what changed — no full install-services rebuild.
for (const relativePath of ["package.json", "package-lock.json", "apps/api/package.json"]) {
  await ssh.putFile(join(repoRoot, relativePath), `${root}\\${relativePath.replace(/\//g, "\\")}`);
  console.log(`Uploaded ${relativePath}`);
}

await run(
  "npm ci",
  `${ps} -NoProfile -Command "Set-Location '${root}'; npm ci"`,
);

const nssm = `${root}\\tools\\nssm.exe`;
await run("Restart API", `${nssm} restart LegalBahiApi`);
await run("Restart worker", `${nssm} restart LegalBahiWorker`);

await run(
  "Verify",
  `${ps} -NoProfile -Command "Start-Sleep -Seconds 10; Get-Service LegalBahiApi,LegalBahiWorker | Format-Table Name,Status -AutoSize; curl.exe -s http://127.0.0.1:3001/health"`,
);

try { ssh.dispose(); } catch {}
console.log("\nDone.");
