import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vendorRoot = join(mobileRoot, "vendor");
const vendorPackageJson = join(vendorRoot, "package.json");

const pinnedPackages = [
  "whatwg-url-without-unicode@8.0.0-3",
  "buffer@5.7.1",
  "punycode@2.3.1",
  "webidl-conversions@5.0.0",
];

rmSync(vendorRoot, { recursive: true, force: true });
mkdirSync(vendorRoot, { recursive: true });

writeFileSync(
  vendorPackageJson,
  JSON.stringify(
    {
      name: "legalbahi-mobile-vendor",
      private: true,
      dependencies: Object.fromEntries(
        pinnedPackages.map((spec) => {
          const atIndex = spec.lastIndexOf("@");
          const name = atIndex > 0 ? spec.slice(0, atIndex) : spec;
          const version = atIndex > 0 ? spec.slice(atIndex + 1) : "latest";
          return [name, version];
        }),
      ),
    },
    null,
    2,
  ),
);

execSync("npm install --omit=dev --no-audit --no-fund", {
  cwd: vendorRoot,
  stdio: "inherit",
});

console.log(`Installed Metro vendor packages in ${vendorRoot}`);
