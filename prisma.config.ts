import { defineConfig } from "prisma/config";

// DATABASE_URL: pooled connection (app). DIRECT_URL: direct connection (migrations).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "" },
});
