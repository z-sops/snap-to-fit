// The Metro configuration for the device benchmark.
//
// The runtime code it measures lives in the repository, outside this folder,
// so Metro has to be told to watch it. The packages come from the
// repository's own `node_modules`, so there is nothing to install here.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
/** The repository, so the runtime and the alias registry can be resolved. */
const repositoryRoot = path.resolve(projectRoot, "..", "..", "..", "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [repositoryRoot];

// The catalogue assets are read at runtime, not bundled, so the file
// extensions have to be asset extensions.
config.resolver.assetExts.push("pack");

module.exports = config;
