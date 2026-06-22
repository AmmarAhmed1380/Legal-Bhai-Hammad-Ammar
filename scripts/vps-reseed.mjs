import { join, dirname } from "node:path";
import { writeFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { NodeSSH } from "node-ssh";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const password = process.env.VPS_SSH_PASSWORD;
if (!password) { console.error("Set VPS_SSH_PASSWORD"); process.exit(1); }

const ssh = new NodeSSH();
await ssh.connect({ host: "64.235.61.6", username: "Administrator", password, tryKeyboard: true });
ssh.connection?.on("error", () => {});
process.on("uncaughtException", (e) => { if (e?.code === "ECONNRESET") return; throw e; });

const psql = "C:\\LegalBahi\\postgresql_local\\pgsql\\bin\\psql.exe";
const ps = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const root = "C:\\LegalBahi";
const envFile = `${root}\\.env.production`;

async function run(label, cmd, { allowFail = false } = {}) {
  console.log(`\n=== ${label} ===`);
  const r = await ssh.execCommand(cmd);
  const out = (r.stdout || r.stderr || "").trim();
  if (out) console.log(out.slice(0, 3000));
  console.log(`exit: ${r.code}`);
  if (!allowFail && r.code !== 0) throw new Error(`${label} failed`);
  return r;
}

// ─────────────────────────────────────────────
// 1. Wipe + re-migrate
// ─────────────────────────────────────────────
await run("Wipe Postgres schema",
  `"${psql}" -U postgres -h 127.0.0.1 -d legalbahi -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`
);
await run("Run migrations",
  `${ps} -NoProfile -ExecutionPolicy Bypass -Command "& { . '${root}\\infra\\windows\\load-environment.ps1' -EnvironmentFile '${envFile}'; Set-Location '${root}'; npm run migrate }"`
);

// ─────────────────────────────────────────────
// 2. Seed via workspace scripts
// ─────────────────────────────────────────────
await run("Run seed:investor",
  `${ps} -NoProfile -ExecutionPolicy Bypass -Command "& { . '${root}\\infra\\windows\\load-environment.ps1' -EnvironmentFile '${envFile}'; Set-Location '${root}'; npm --workspace @wakeel/api run seed:investor }"`
);
await run("Run migrate:seed-r2",
  `${ps} -NoProfile -ExecutionPolicy Bypass -Command "& { . '${root}\\infra\\windows\\load-environment.ps1' -EnvironmentFile '${envFile}'; Set-Location '${root}'; npm --workspace @wakeel/api run migrate:seed-r2 }"`
);

// ─────────────────────────────────────────────
// 3. Verify counts
// ─────────────────────────────────────────────
await run("Final data counts",
  `"${psql}" -U postgres -h 127.0.0.1 -d legalbahi -c "SELECT tbl, cnt FROM (SELECT 'firms' tbl, COUNT(*)::int cnt FROM firms UNION ALL SELECT 'product_users', COUNT(*) FROM product_users UNION ALL SELECT 'firm_memberships', COUNT(*) FROM firm_memberships UNION ALL SELECT 'client_accounts', COUNT(*) FROM client_accounts UNION ALL SELECT 'matters', COUNT(*) FROM matters UNION ALL SELECT 'matter_parties', COUNT(*) FROM matter_parties UNION ALL SELECT 'hearings', COUNT(*) FROM hearings UNION ALL SELECT 'alerts', COUNT(*) FROM alerts UNION ALL SELECT 'messages', COUNT(*) FROM messages UNION ALL SELECT 'documents', COUNT(*) FROM documents UNION ALL SELECT 'court_sources', COUNT(*) FROM court_sources) t ORDER BY tbl;"`,
  { allowFail: true }
);

ssh.dispose();
console.log("\nSeed complete!");
