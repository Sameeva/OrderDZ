import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile();
} catch {
  // no .env: TEST_DATABASE_URL comes from the environment, database tests are skipped without it
}

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // the db test files share one database and wipe it in beforeEach, so they must not overlap
    fileParallelism: false,
  },
});
