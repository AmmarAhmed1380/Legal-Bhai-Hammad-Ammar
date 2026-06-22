import { NodeSSH } from "node-ssh";

const host = process.env.VPS_HOST ?? "64.235.61.6";
const username = process.env.VPS_USER ?? "Administrator";
const password = process.env.VPS_SSH_PASSWORD;
const vpsRoot = process.env.VPS_ROOT ?? "C:/LegalBahi";
const vpsRootWin = vpsRoot.replace(/\//g, "\\");

if (!password) {
  console.error("Set VPS_SSH_PASSWORD to the Windows Administrator password for the VPS.");
  process.exit(1);
}

const powershell = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const envFile = `${vpsRootWin}\\.env.production`;

const ssh = new NodeSSH();

async function runRemote(label, command) {
  console.log(label);
  const result = await ssh.execCommand(command);
  if (result.stdout.trim()) {
    console.log(result.stdout.trim());
  }
  if (result.stderr.trim()) {
    console.error(result.stderr.trim());
  }
  if (result.code !== 0) {
    throw new Error(`${label} failed with exit code ${result.code}`);
  }
}

console.log(`Connecting to ${username}@${host} ...`);
await ssh.connect({ host, username, password, tryKeyboard: true });
ssh.connection?.on("error", () => {});

// Ignore late SSH socket resets after Windows service restarts.
process.on("uncaughtException", (error) => {
  if (error && typeof error === "object" && "code" in error && error.code === "ECONNRESET") {
    return;
  }
  throw error;
});

const steps = [
  [
    "Starting bundled PostgreSQL ...",
    `${powershell} -NoProfile -ExecutionPolicy Bypass -File ${vpsRootWin}\\infra\\windows\\start-postgres.ps1 -Root ${vpsRootWin}`,
  ],
  [
    "Applying Postgres migrations ...",
    `${powershell} -NoProfile -ExecutionPolicy Bypass -File ${vpsRootWin}\\infra\\windows\\migrate-postgres.ps1 -EnvironmentFile ${envFile}`,
  ],
  [
    "Seeding investor demo data ...",
    `${powershell} -NoProfile -ExecutionPolicy Bypass -File ${vpsRootWin}\\infra\\windows\\seed-investor-postgres.ps1 -EnvironmentFile ${envFile}`,
  ],
  [
    "Migrating seed documents to R2 ...",
    `${powershell} -NoProfile -ExecutionPolicy Bypass -Command "& { . '${vpsRootWin}\\infra\\windows\\load-environment.ps1' -EnvironmentFile '${envFile}'; Set-Location '${vpsRootWin}'; npm --workspace @wakeel/api run migrate:seed-r2; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }"`,
  ],
  [
    "Restarting LegalBahi services ...",
    `${powershell} -NoProfile -ExecutionPolicy Bypass -Command "Restart-Service LegalBahiApi, LegalBahiWorker, LegalBahiWeb, caddy -Force; Write-Output 'All services restarted successfully'"`,
  ],
];

for (const [label, command] of steps) {
  await runRemote(label, command);
}

try {
  ssh.connection?.removeAllListeners("error");
  ssh.dispose();
} catch {
  // SSH may reset when Windows services restart during deploy.
}
console.log("VPS remote deploy complete.");
