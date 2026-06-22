import { existsSync, statSync } from "node:fs";
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
  console.error("Set VPS_SSH_PASSWORD to the Windows Administrator password for the VPS.");
  process.exit(1);
}

const cleanPaths = [
  `${vpsRootWin}\\apps.zip`,
  `${vpsRootWin}\\nssm.zip`,
  `${vpsRootWin}\\nssm-2.24`,
  `${vpsRootWin}\\vps_deploy_tar.ps1`,
  `${vpsRootWin}\\packages\\.env`,
  `${vpsRootWin}\\packages\\.env.example`,
  `${vpsRootWin}\\packages\\.env.production.example`,
  `${vpsRootWin}\\packages\\apps`,
  `${vpsRootWin}\\apps\\web\\page.tsx`,
  `${vpsRootWin}\\apps\\web\\layout.tsx`,
  `${vpsRootWin}\\apps\\web\\globals.css`,
  `${vpsRootWin}\\apps\\web\\c`,
  `${vpsRootWin}\\apps\\web\\client`,
  `${vpsRootWin}\\apps\\web\\product`,
  `${vpsRootWin}\\apps\\web\\app.zip`,
  `${vpsRootWin}\\apps\\web\\.next`,
];

const syncPaths = [
  "package.json",
  "package-lock.json",
  "packages/shared",
  "apps/api/package.json",
  "apps/api/src",
  "apps/web/package.json",
  "apps/web/tsconfig.json",
  "apps/web/next.config.mjs",
  "apps/web/postcss.config.mjs",
  "apps/web/app",
  "apps/web/lib",
  "infra/postgres/migrations",
  "infra/windows",
];

const ssh = new NodeSSH();

async function runRemote(label, command, { allowFail = false } = {}) {
  console.log(`\n=== ${label} ===`);
  const result = await ssh.execCommand(command);
  const out = (result.stdout || result.stderr || "").trim();
  if (out) console.log(out.slice(0, 4000));
  console.log(`exit code: ${result.code}`);
  if (!allowFail && result.code !== 0) {
    throw new Error(`${label} failed`);
  }
  return result;
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

const powershell = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";

// 1. Cleanup old files
console.log("Cleaning up obsolete files on the VPS...");
for (const p of cleanPaths) {
  const cleanCmd = `${powershell} -NoProfile -Command "Remove-Item -Path '${p}' -Recurse -Force -ErrorAction SilentlyContinue"`;
  await ssh.execCommand(cleanCmd);
  console.log(`Cleaned: ${p}`);
}

// 2. Stop running services temporarily before npm ci to prevent locked file errors
const nssm = `${vpsRootWin}\\tools\\nssm.exe`;
await runRemote("Stopping API service", `${nssm} stop LegalBahiApi`, { allowFail: true });
await runRemote("Stopping Worker service", `${nssm} stop LegalBahiWorker`, { allowFail: true });
await runRemote("Stopping Web service", `${nssm} stop LegalBahiWeb`, { allowFail: true });

// 3. Sync source directories
for (const relativePath of syncPaths) {
  const localPath = join(repoRoot, relativePath);
  if (!existsSync(localPath)) {
    console.warn(`Warning: Missing local path: ${localPath}`);
    continue;
  }
  const remotePath = `${vpsRootWin}\\${relativePath.replace(/\//g, "\\")}`;
  console.log(`Uploading ${relativePath} -> ${remotePath}`);
  if (statSync(localPath).isDirectory()) {
    const failed = await ssh.putDirectory(localPath, remotePath, {
      recursive: true,
      concurrency: 8,
      validate: (itemPath) => !itemPath.endsWith(".test.ts") && !itemPath.includes(".next") && !itemPath.includes("node_modules"),
    });
    if (failed.length > 0) {
      throw new Error(`Failed to upload ${failed.length} file(s) under ${relativePath}`);
    }
    continue;
  }
  await ssh.putFile(localPath, remotePath);
}

// 4. Run clean dependency install
await runRemote(
  "Running npm install on the VPS",
  `${powershell} -NoProfile -Command "Set-Location '${vpsRootWin}'; npm install --no-audit"`
);

// 5. Rebuild the frontend Web bundle
await runRemote(
  "Rebuilding production web bundle on the VPS",
  `${powershell} -NoProfile -ExecutionPolicy Bypass -File ${vpsRootWin}\\infra\\windows\\build-web.ps1 -Root ${vpsRootWin} -EnvironmentFile ${vpsRootWin}\\.env.production`
);

ssh.dispose();
console.log("\nVPS sync complete!");
