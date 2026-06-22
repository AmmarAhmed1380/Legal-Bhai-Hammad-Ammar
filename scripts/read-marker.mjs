import { NodeSSH } from "node-ssh";

const password = process.env.VPS_SSH_PASSWORD;
const ssh = new NodeSSH();
await ssh.connect({ host: "64.235.61.6", username: "Administrator", password, tryKeyboard: true });

const r1 = await ssh.execCommand("powershell -NoProfile -Command \"Test-Path C:\\LegalBahi\\apps\\web\\.next\\legalbahi-production-api.txt\"");
console.log("File exists:", r1.stdout.trim());

const r2 = await ssh.execCommand("powershell -NoProfile -Command \"Get-Content C:\\LegalBahi\\apps\\web\\.next\\legalbahi-production-api.txt -Raw\"");
console.log("File content:", JSON.stringify(r2.stdout.trim()));

ssh.dispose();
