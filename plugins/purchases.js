const { withAndroidManifest } = require("expo/config-plugins");
module.exports = (config) =>
  withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application?.[0];
    const main = app?.activity?.find(
      (a) => a.$["android:name"] === ".MainActivity",
    );
    if (main) main.$["android:launchMode"] = "singleTop";
    return config;
  });
