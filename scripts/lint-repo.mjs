import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const listed = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
})
  .split(/\r?\n/)
  .filter(Boolean);

const forbiddenPathPatterns = [
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)__MACOSX(\/|$)/,
  /(^|\/)\.DS_Store$/,
  /(^|\/)\.expo(\/|$)/,
  /(^|\/)\.next(\/|$)/,
  /(^|\/)\.turbo(\/|$)/,
  /(^|\/)\.vercel(\/|$)/,
  /(^|\/)playwright-report(\/|$)/,
  /(^|\/)test-results(\/|$)/,
  /(^|\/)blob-report(\/|$)/,
  /(^|\/)(dist|build|coverage)(\/|$)/,
  /(^|\/)logs?(\/|$)/,
  /(^|\/)data\/uploads(\/|$)/,
  /(^|\/)data\/(product-uploads|brother-test-uploads|runtime)(\/|$)/,
  /(^|\/)apps\/api\/data\/uploads(\/|$)/,
  /(^|\/)apps\/api\/data\/(runtime|product-uploads)(\/|$)/,
  /\.(sqlite|sqlite-wal|sqlite-shm|log|zip|tgz|tar|tar\.gz|dump|dump\.age|apk|aab|tsbuildinfo)$/i,
];

const secretFilePatterns = [
  /(^|\/)\.env$/,
  /(^|\/)\.env\.(?!example$)[^/]+$/,
  /\.(pem|p12|pfx|key)$/i,
];

const violations = [];

for (const file of listed) {
  if (forbiddenPathPatterns.some((pattern) => pattern.test(file))) {
    violations.push(`runtime artifact is not ignored: ${file}`);
  }
  if (secretFilePatterns.some((pattern) => pattern.test(file))) {
    violations.push(`secret-like file is not ignored: ${file}`);
  }
}

for (const file of listed.filter((path) => /\.(ts|tsx|js|mjs|json|md|sql|ps1|yml|yaml|example)$/i.test(path))) {
  const source = readFileSync(file, "utf8");
  if (/AKIA[0-9A-Z]{16}/.test(source)) {
    violations.push(`possible AWS access key in ${file}`);
  }
  if (/-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/.test(source)) {
    violations.push(`private key material in ${file}`);
  }
}

if (violations.length > 0) {
  throw new Error(`Repository lint failed:\n${violations.map((violation) => `- ${violation}`).join("\n")}`);
}

console.log(`Repository lint passed for ${listed.length} unignored files`);
