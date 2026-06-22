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
const psql = `${vpsRootWin}\\postgresql_local\\pgsql\\bin\\psql.exe`;

const ssh = new NodeSSH();

async function runRemote(label, command) {
  console.log(`\n=== ${label} ===`);
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

process.on("uncaughtException", (error) => {
  if (error && typeof error === "object" && "code" in error && error.code === "ECONNRESET") {
    return;
  }
  throw error;
});

try {
  // 1. Ensure Postgres service is running
  await runRemote(
    "Ensuring PostgreSQL is running",
    `${powershell} -NoProfile -Command "if ((Get-Service LegalBahiPostgres).Status -ne 'Running') { Start-Service LegalBahiPostgres }"`
  );

  // 2. Wipe PostgreSQL schema to remove bad traces/stale tables
  await runRemote(
    "Wiping PostgreSQL schema",
    `"${psql}" -U postgres -h 127.0.0.1 -d legalbahi -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`
  );

  // 3. Run migrations on Postgres
  await runRemote(
    "Applying migrations to Postgres",
    `${powershell} -NoProfile -ExecutionPolicy Bypass -Command "& { . '${vpsRootWin}\\infra\\windows\\load-environment.ps1' -EnvironmentFile '${envFile}'; Set-Location '${vpsRootWin}'; npm run migrate; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }"`
  );

  // 4. Seed investor demo data to Postgres
  await runRemote(
    "Seeding investor demo data to Postgres",
    `${powershell} -NoProfile -ExecutionPolicy Bypass -Command "& { . '${vpsRootWin}\\infra\\windows\\load-environment.ps1' -EnvironmentFile '${envFile}'; Set-Location '${vpsRootWin}'; npm --workspace @wakeel/api run seed:investor; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }"`
  );

  // 5. Migrate seed documents to R2
  await runRemote(
    "Migrating seed documents to R2",
    `${powershell} -NoProfile -ExecutionPolicy Bypass -Command "& { . '${vpsRootWin}\\infra\\windows\\load-environment.ps1' -EnvironmentFile '${envFile}'; Set-Location '${vpsRootWin}'; npm --workspace @wakeel/api run migrate:seed-r2; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }"`
  );

  // 6. Install and configure services with the relaxed validation
  await runRemote(
    "Installing/configuring NSSM services",
    `${powershell} -NoProfile -ExecutionPolicy Bypass -File ${vpsRootWin}\\infra\\windows\\install-services.ps1 -Root ${vpsRootWin} -EnvironmentFile ${envFile}`
  );

  // 7. Restart Caddy to ensure web server is routing correctly
  await runRemote(
    "Restarting Caddy",
    `${powershell} -NoProfile -ExecutionPolicy Bypass -Command "Restart-Service caddy -Force"`
  );

  console.log("\nVPS clean deployment completed successfully!");
} finally {
  try {
    ssh.dispose();
  } catch {}
}
