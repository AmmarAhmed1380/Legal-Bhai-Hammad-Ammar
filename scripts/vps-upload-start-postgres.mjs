import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

import { NodeSSH } from "node-ssh";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const password = process.env.VPS_SSH_PASSWORD;
const host = process.env.VPS_HOST ?? "64.235.61.6";
const username = process.env.VPS_USER ?? "Administrator";
const vpsRootWin = (process.env.VPS_ROOT ?? "C:/LegalBahi").replace(/\//g, "\\");

if (!password) {
  process.exit(1);
}

const ssh = new NodeSSH();
await ssh.connect({ host, username, password, tryKeyboard: true });
ssh.connection?.on("error", () => {});

const localPath = join(repoRoot, "infra", "windows", "start-postgres.ps1");
await ssh.putFile(localPath, `${vpsRootWin}\\infra\\windows\\start-postgres.ps1`);
console.log("Uploaded start-postgres.ps1");

ssh.dispose();
