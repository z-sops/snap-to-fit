import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/*.ui.test.tsx"],
    globals: true,
    setupFiles: ["tests/setup-ui.ts"],
  },
  resolve: { alias: { "react-native": "react-native-web" } },
});
