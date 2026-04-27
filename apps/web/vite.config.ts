import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@cloudguardx/shared-types": path.resolve(__dirname, "../../packages/shared-types/src/index.ts")
    }
  },
  test: {
    environment: "jsdom"
  }
});
