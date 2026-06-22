import { NodeSSH } from "node-ssh";

const password = process.env.VPS_SSH_PASSWORD;
if (!password) { console.error("Set VPS_SSH_PASSWORD"); process.exit(1); }

const ssh = new NodeSSH();
await ssh.connect({ host: "64.235.61.6", username: "Administrator", password, tryKeyboard: true });

const ps = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const nssm = "C:\\LegalBahi\\tools\\nssm.exe";

async function run(label, cmd, { allowFail = false } = {}) {
  console.log(`\n=== ${label} ===`);
  const r = await ssh.execCommand(cmd);
  const out = (r.stdout || r.stderr || "").trim();
  if (out) console.log(out.slice(0, 3000));
  return r;
}

// 1. Services
await run("All services", `${ps} -NoProfile -Command "Get-Service LegalBahiApi,LegalBahiWorker,LegalBahiWeb,caddy,LegalBahiPostgres | Format-Table Name,Status -AutoSize"`, { allowFail: true });

// 2. Internal health checks
await run("Local /health", `curl.exe -s http://127.0.0.1:3001/health`, { allowFail: true });
await run("Local /health/ready", `curl.exe -s http://127.0.0.1:3001/health/ready`, { allowFail: true });

// 3. Public HTTPS health
await run("Public API /health (HTTPS)", `curl.exe -sk https://api-64-235-61-6.sslip.io/health`, { allowFail: true });

// 4. CORS preflight from sslip.io
await run("CORS preflight (sslip origin - auth)",
  `curl.exe -sk -o - -w "\\nHTTP_STATUS:%{http_code}" -X OPTIONS "https://api-64-235-61-6.sslip.io/v1/auth/otp/request" -H "Origin: https://64.235.61.6.sslip.io" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: Content-Type"`,
  { allowFail: true }
);

await run("CORS preflight (sslip origin - reports)",
  `curl.exe -sk -o - -w "\\nHTTP_STATUS:%{http_code}" -X OPTIONS "https://api-64-235-61-6.sslip.io/v1/reports/overview" -H "Origin: https://64.235.61.6.sslip.io" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: Authorization"`,
  { allowFail: true }
);

// 5. Actual POST to /v1/auth/otp/request (expect 200 or 422 with CORS headers, not blocked)
await run("POST /v1/auth/otp/request (expect JSON, not CORS block)",
  `curl.exe -sk -w "\\nHTTP_STATUS:%{http_code}" -X POST "https://api-64-235-61-6.sslip.io/v1/auth/otp/request" -H "Origin: https://64.235.61.6.sslip.io" -H "Content-Type: application/json" -d "{\"phone\":\"+923001234567\"}"`,
  { allowFail: true }
);

// 6. Check web is serving
await run("Public Web /  (HTTPS)", `curl.exe -sk -o - -w "\\nHTTP_STATUS:%{http_code}" https://64.235.61.6.sslip.io`, { allowFail: true });

// 7. Active ports
await run("Active ports 3000,3001,5432",
  `${ps} -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000,3001,5432 -ErrorAction SilentlyContinue | Format-Table LocalAddress,LocalPort,State -AutoSize"`,
  { allowFail: true }
);

ssh.dispose();
console.log("\n=== End-to-end verification complete! ===");
