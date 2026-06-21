import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

const uploads = [
  [".env.production", `${vpsRoot}/.env.production`],
  ["infra/windows/Caddyfile", `${vpsRoot}/infra/windows/Caddyfile`],
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

const nssm = `${vpsRootWin}\\tools\\nssm.exe`;
const caddyCheck = await ssh.execCommand("sc query caddy");
if (caddyCheck.code !== 0) {
  console.log("Installing Caddy Windows service ...");
  for (const command of [
    `${nssm} install caddy C:\\Windows\\System32\\caddy.exe run --config ${vpsRootWin}\\infra\\windows\\Caddyfile`,
    `${nssm} set caddy AppDirectory ${vpsRootWin}`,
    `${nssm} set caddy Start SERVICE_AUTO_START`,
    "net start caddy",
  ]) {
    await runRemote("Caddy setup", command);
  }
}

for (const command of [
  "netsh advfirewall firewall add rule name=\"LegalBahi HTTP\" dir=in action=allow protocol=TCP localport=80",
  "netsh advfirewall firewall add rule name=\"LegalBahi HTTPS\" dir=in action=allow protocol=TCP localport=443",
]) {
  await ssh.execCommand(command);
}

const tempDir = mkdtempSync(join(tmpdir(), "legalbahi-vps-"));

for (const [localPath, remotePath] of uploads) {
  const content = readFileSync(join(repoRoot, localPath), "utf8");
  const localTemp = join(tempDir, localPath.replace(/[/\\]/g, "_"));
  writeFileSync(localTemp, content, "utf8");
  await ssh.putFile(localTemp, remotePath);
  console.log(`Uploaded ${localPath} -> ${remotePath}`);
}

const powershell = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";

if (process.env.VPS_SKIP_WEB_REBUILD !== "true") {
  await runRemote(
    "Rebuilding production web bundle ...",
    `${powershell} -NoProfile -ExecutionPolicy Bypass -File ${vpsRootWin}\\infra\\windows\\build-web.ps1 -Root ${vpsRootWin} -EnvironmentFile ${vpsRootWin}\\.env.production`,
  );
}

await runRemote(
  "Restarting API/worker/web services ...",
  `${powershell} -NoProfile -ExecutionPolicy Bypass -File ${vpsRootWin}\\infra\\windows\\install-services.ps1 -Root ${vpsRootWin} -EnvironmentFile ${vpsRootWin}\\.env.production`,
);

await runRemote(
  "Reloading Caddy ...",
  `${powershell} -NoProfile -ExecutionPolicy Bypass -Command "if (Get-Service caddy -ErrorAction SilentlyContinue) { Restart-Service caddy -Force; Write-Output 'Restarted caddy service' } elseif (Get-Command caddy -ErrorAction SilentlyContinue) { & caddy reload --config '${vpsRootWin}\\infra\\windows\\Caddyfile'; Write-Output 'Reloaded caddy config' } else { throw 'Caddy is not installed' }"`,
);

ssh.connection?.removeAllListeners("error");
ssh.dispose();
console.log("VPS config sync complete.");
