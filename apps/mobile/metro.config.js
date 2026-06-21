const path = require("path");
const fs = require("fs");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");
const vendorRoot = path.resolve(projectRoot, "vendor");
const vendorNodeModules = path.join(vendorRoot, "node_modules");
const monorepoPackageJson = path.join(monorepoRoot, "package.json");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

const isMonorepo =
  fs.existsSync(monorepoPackageJson) &&
  Array.isArray(JSON.parse(fs.readFileSync(monorepoPackageJson, "utf8")).workspaces);

const pinnedPackages = [
  "whatwg-url-without-unicode",
  "buffer",
  "punycode",
  "webidl-conversions",
  "ieee754",
  "base64-js",
];

function resolveVendorEntry(packageName) {
  const vendorPackageJson = path.join(vendorNodeModules, packageName, "package.json");
  if (!fs.existsSync(vendorPackageJson)) {
    return null;
  }
  const packageMeta = JSON.parse(fs.readFileSync(vendorPackageJson, "utf8"));
  const mainFile = packageMeta.main ?? "index.js";
  return path.join(vendorNodeModules, packageName, mainFile);
}

const pinnedPackageEntries = Object.fromEntries(
  pinnedPackages.flatMap((packageName) => {
    const entry = resolveVendorEntry(packageName);
    return entry ? [[packageName, entry]] : [];
  }),
);

if (isMonorepo) {
  config.watchFolders = [monorepoRoot, vendorRoot];
  config.resolver.nodeModulesPaths = [
    vendorNodeModules,
    path.resolve(projectRoot, "node_modules"),
    path.resolve(monorepoRoot, "node_modules"),
  ];
  config.resolver.extraNodeModules = pinnedPackages.reduce((accumulator, packageName) => {
    const vendorPackageRoot = path.join(vendorNodeModules, packageName);
    if (fs.existsSync(path.join(vendorPackageRoot, "package.json"))) {
      accumulator[packageName] = vendorPackageRoot;
    }
    return accumulator;
  }, {});

  const upstreamResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const pinnedEntry = pinnedPackageEntries[moduleName];
    if (pinnedEntry) {
      return { type: "sourceFile", filePath: pinnedEntry };
    }
    if (upstreamResolveRequest) {
      return upstreamResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
