import { execSync, spawn } from "node:child_process";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const apiPort = Number(process.env.BROTHER_API_PORT ?? 3001);
const webPort = Number(process.env.BROTHER_WEB_PORT ?? 3000);
const metroPort = Number(process.env.BROTHER_METRO_PORT ?? 8081);
const startMobile = process.argv.includes("--mobile");
const pilotAdminSecret = "legalbahi-brother-test-admin-secret";
const testDatabase = resolve(root, "data", "legalbahi-brother-test.sqlite");
const testUploads = resolve(root, "data", "brother-test-uploads");
const children = [];

function findLanAddress() {
  const interfaces = networkInterfaces();
  const preferredNames = ["en0", "en1", ...Object.keys(interfaces)];
  const seen = new Set();

  for (const name of preferredNames) {
    if (seen.has(name) || /^(lo|utun|bridge|docker|vmenet|awdl|llw)/i.test(name)) {
      continue;
    }
    seen.add(name);
    const address = interfaces[name]?.find((entry) => entry.family === "IPv4" && !entry.internal);
    if (address) {
      return address.address;
    }
  }

  return "127.0.0.1";
}

function freePort(port) {
  if (!Number.isInteger(port) || port <= 0) {
    return;
  }
  try {
    if (process.platform === "win32") {
      execSync(
        `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { if ($_.OwningProcess -gt 0) { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }"`,
        { stdio: "ignore" },
      );
      return;
    }
    execSync(`lsof -ti tcp:${port} | xargs kill -9 2>/dev/null || true`, { stdio: "ignore", shell: true });
  } catch {
    // Port was already free.
  }
}

function freeDevPorts() {
  const ports = new Set([apiPort, webPort]);
  if (startMobile) {
    ports.add(metroPort);
  }
  for (const port of ports) {
    freePort(port);
  }
}

function startProcess(label, command, args, env, inheritOutput = false) {
  const useWindowsCmd = process.platform === "win32";
  const spawnCommand = useWindowsCmd ? "cmd.exe" : command;
  const spawnArgs = useWindowsCmd ? ["/d", "/s", "/c", command, ...args] : args;
  const child = spawn(spawnCommand, spawnArgs, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: inheritOutput ? ["ignore", "inherit", "inherit"] : ["inherit", "pipe", "pipe"],
    shell: false,
  });
  if (!inheritOutput) {
    const prefix = (chunk, stream) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        if (line) {
          stream.write(`[${label}] ${line}\n`);
        }
      }
    };
    child.stdout.on("data", (chunk) => prefix(chunk, process.stdout));
    child.stderr.on("data", (chunk) => prefix(chunk, process.stderr));
  }
  child.on("exit", (code, signal) => {
    if (!shuttingDown && code !== 0) {
      console.error(`[${label}] stopped unexpectedly (${signal ?? code})`);
      shutdown(1);
    }
  });
  children.push(child);
  return child;
}

async function waitFor(url, label) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Service is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error(`${label} did not become ready at ${url}`);
}

async function inviteBrother(apiUrl) {
  const phone = process.env.BROTHER_PHONE?.trim();
  if (!phone) {
    return null;
  }
  const response = await fetch(`${apiUrl}/v1/pilot/invites`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-pilot-admin-secret": pilotAdminSecret,
    },
    body: JSON.stringify({
      phone,
      email: process.env.BROTHER_EMAIL?.trim() || null,
    }),
  });
  if (!response.ok) {
    throw new Error(`Could not invite BROTHER_PHONE: ${await response.text()}`);
  }
  return phone;
}

let shuttingDown = false;
function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(exitCode), 300).unref();
}

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());

const lanAddress = process.env.BROTHER_TEST_HOST?.trim() || findLanAddress();
if (lanAddress === "127.0.0.1") {
  console.warn("Could not find a LAN address. Only this computer will be able to open the app.");
}
const apiUrl = `http://${lanAddress}:${apiPort}`;
const webUrl = `http://${lanAddress}:${webPort}`;
const commonEnvironment = {
  NODE_ENV: "development",
  ENABLE_DEMO_SURFACES: "false",
  ENABLE_PRODUCT_SEED_DATA: "true",
  USE_POSTGRES_PRODUCT_STORE: "false",
  IHC_LIVE_FETCH_ENABLED: "false",
  COURT_LIVE_FETCH_ENABLED: "false",
  WAKEEL_PRODUCT_DB_PATH: testDatabase,
  PRODUCT_UPLOADS_DIRECTORY: testUploads,
  JWT_SECRET: "legalbahi-brother-test-jwt-secret",
  PILOT_ADMIN_SECRET: pilotAdminSecret,
  WAKEEL_DEV_OTP_CODE: "246810",
  PUBLIC_API_URL: apiUrl,
  PUBLIC_WEB_URL: webUrl,
};

try {
  freeDevPorts();
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 750));

  startProcess("api", npmCommand, ["--workspace", "@wakeel/api", "run", "start"], {
    ...commonEnvironment,
    HOST: "0.0.0.0",
    PORT: String(apiPort),
    CORS_ORIGINS: [
      webUrl,
      apiUrl,
      `http://localhost:${webPort}`,
      `http://127.0.0.1:${webPort}`,
      `http://localhost:${apiPort}`,
      `http://127.0.0.1:${apiPort}`,
      "http://localhost:8081",
      "http://127.0.0.1:8081",
    ].join(","),
  });
  await waitFor(`${apiUrl}/health/ready`, "API");

  const invitedPhone = await inviteBrother(apiUrl);

  startProcess("web", npmCommand, ["--workspace", "@wakeel/web", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", String(webPort)], {
    ...commonEnvironment,
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_ENABLE_DEMO_SURFACES: "false",
  });
  await waitFor(`${webUrl}/overview`, "Web app");

  if (startMobile) {
    execSync("node scripts/sync-vendor.mjs", { cwd: resolve(root, "apps/mobile"), stdio: "inherit" });
    startProcess("mobile", npmCommand, ["--workspace", "@wakeel/mobile", "exec", "expo", "start", "--", "--lan", "--port", String(metroPort)], {
      ...commonEnvironment,
      EXPO_PUBLIC_API_URL: apiUrl,
      EXPO_PUBLIC_ENABLE_DEMO_SURFACES: "false",
    }, true);
  }

  console.log(`
LegalBahi brother testing is ready.

Open on a phone or laptop connected to the same Wi-Fi:
  ${webUrl}/overview

Existing lawyer test account:
  Phone: 03001234567
  OTP:   246810

Existing client test account:
  Phone: 03005550001
  OTP:   246810

${invitedPhone ? `Fresh invited-lawyer signup phone:\n  Phone: ${invitedPhone}\n  OTP:   246810\n` : "To test fresh lawyer signup, stop this command and restart with:\n  BROTHER_PHONE=03XXXXXXXXX npm run brother:test\n"}
Use fake test information only. Keep this terminal open while he tests.
Press Ctrl+C to stop the test server.
`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  shutdown(1);
}
