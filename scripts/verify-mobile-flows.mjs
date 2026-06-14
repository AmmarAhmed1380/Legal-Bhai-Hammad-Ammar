import { readFileSync } from "node:fs";

import { parseAllDocuments } from "yaml";

const app = JSON.parse(readFileSync("apps/mobile/app.json", "utf8"));
const expectedAppId = app.expo.android.package;
const entrySource = readFileSync("apps/mobile/App.tsx", "utf8");
const apiSource = readFileSync("apps/mobile/src/api.ts", "utf8");
const productSource = readFileSync("apps/mobile/src/productApp.tsx", "utf8");

for (const requiredText of [
  'process.env.EXPO_PUBLIC_ENABLE_DEMO_SURFACES === "true"',
  "return <ProductApp />",
]) {
  if (!entrySource.includes(requiredText)) {
    throw new Error(`apps/mobile/App.tsx is missing production entry guard: ${requiredText}`);
  }
}
for (const requiredText of [
  "EXPO_PUBLIC_API_URL is required in production LegalBahi builds",
  "Production LegalBahi builds require an HTTPS API URL",
]) {
  if (!apiSource.includes(requiredText)) {
    throw new Error(`apps/mobile/src/api.ts is missing production API validation: ${requiredText}`);
  }
}
if (!productSource.includes('apiRequest("/v1/auth/logout", { method: "POST" }, auth.token)')) {
  throw new Error("LegalBahi mobile sign out must revoke the server session");
}
const flows = [
  {
    path: "apps/mobile/maestro/invited-signup.yaml",
    requiredText: ["Invited lawyer? Create workspace", "Request OTP", "Verify OTP and sign in"],
  },
  {
    path: "apps/mobile/maestro/hearing-client-update.yaml",
    requiredText: ["Matters", "Save hearing update", "Send update"],
  },
];

for (const flow of flows) {
  const source = readFileSync(flow.path, "utf8");
  const documents = parseAllDocuments(source);
  if (documents.some((document) => document.errors.length > 0)) {
    throw new Error(`${flow.path} contains invalid YAML`);
  }
  const header = documents[0]?.toJSON();
  const commands = documents[1]?.toJSON();
  if (header?.appId !== expectedAppId) {
    throw new Error(`${flow.path} appId does not match ${expectedAppId}`);
  }
  if (!Array.isArray(commands) || commands.length === 0) {
    throw new Error(`${flow.path} has no Maestro commands`);
  }
  for (const requiredText of flow.requiredText) {
    if (!source.includes(requiredText)) {
      throw new Error(`${flow.path} is missing required step text: ${requiredText}`);
    }
  }
}

console.log(`Verified ${flows.length} LegalBahi Android Maestro flows for ${expectedAppId}`);
