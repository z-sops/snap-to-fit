import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/*.ui.test.tsx"],
    globals: true,
  },
  resolve: { alias: { "react-native": "react-native-web" } },
});
