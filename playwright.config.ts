import { tmpdir } from "node:os";
import { join } from "node:path";

import { defineConfig, devices } from "@playwright/test";

const apiPort = 3401;
const webPort = 3400;
const e2eDatabase = join(tmpdir(), `legalbahi-web-e2e-${process.pid}-${Date.now()}.sqlite`);

export default defineConfig({
  testDir: "./apps/web/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: "npm --workspace @wakeel/api run start",
      env: {
        NODE_ENV: "development",
        PORT: String(apiPort),
        CORS_ORIGINS: `http://127.0.0.1:${webPort}`,
        PUBLIC_API_URL: `http://127.0.0.1:${apiPort}`,
        PUBLIC_WEB_URL: `http://127.0.0.1:${webPort}`,
        JWT_SECRET: "legalbahi-e2e-jwt-secret",
        PILOT_ADMIN_SECRET: "legalbahi-e2e-admin-secret",
        ENABLE_DEMO_SURFACES: "false",
        ENABLE_PRODUCT_SEED_DATA: "false",
        WAKEEL_PRODUCT_DB_PATH: e2eDatabase,
        WAKEEL_DEV_OTP_CODE: "246810",
      },
      url: `http://127.0.0.1:${apiPort}/health/ready`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: `npm --workspace @wakeel/web run dev -- --hostname 127.0.0.1 --port ${webPort}`,
      env: {
        NODE_ENV: "development",
        NEXT_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}`,
        ENABLE_DEMO_SURFACES: "false",
        NEXT_PUBLIC_ENABLE_DEMO_SURFACES: "false",
      },
      url: `http://127.0.0.1:${webPort}/overview`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
