import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/*.ui.test.tsx"],
    globals: true,
    setupFiles: ["tests/setup-ui.ts"],
    // The screen tests drive whole screens, so they need more than the 5 second
    // default on a loaded or slower machine. Without this the suite fails at
    // random depending on how many workers the machine can run at once.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: { alias: { "react-native": "react-native-web" } },
});
