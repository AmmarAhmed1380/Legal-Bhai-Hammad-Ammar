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

const uploadPaths = [
  "apps/api/src",
  "apps/api/package.json",
  "packages/shared",
  "infra/postgres/migrations",
  "infra/windows",
];

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

process.on("uncaughtException", (error) => {
  if (error && typeof error === "object" && "code" in error && error.code === "ECONNRESET") {
    return;
  }
  throw error;
});

for (const relativePath of uploadPaths) {
  const localPath = join(repoRoot, relativePath);
  if (!existsSync(localPath)) {
    throw new Error(`Missing local path: ${localPath}`);
  }
  const remotePath = `${vpsRootWin}\\${relativePath.replace(/\//g, "\\")}`;
  console.log(`Uploading ${relativePath} -> ${remotePath}`);
  if (statSync(localPath).isDirectory()) {
    const failed = await ssh.putDirectory(localPath, remotePath, {
      recursive: true,
      concurrency: 8,
      validate: (itemPath) => !itemPath.endsWith(".test.ts"),
    });
    if (failed.length > 0) {
      throw new Error(`Failed to upload ${failed.length} file(s) under ${relativePath}`);
    }
    continue;
  }
  await ssh.putFile(localPath, remotePath);
}

const powershell = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";

await runRemote(
  "Restarting LegalBahi API and worker services ...",
  `${powershell} -NoProfile -ExecutionPolicy Bypass -Command "Restart-Service LegalBahiApi,LegalBahiWorker -Force; Write-Output 'Restarted LegalBahiApi and LegalBahiWorker'"`,
);

ssh.connection?.removeAllListeners("error");
ssh.dispose();
console.log("VPS API sync complete.");
