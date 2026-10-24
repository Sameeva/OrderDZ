import { defineConfig } from "prisma/config";

// Prisma 7 does not read .env itself.
try {
  process.loadEnvFile();
} catch {
  // no .env (CI, production): variables come from the environment
}

// DATABASE_URL: pooled connection (app). DIRECT_URL: direct connection (migrations).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "" },
});
