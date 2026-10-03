import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // The CLI (migrations) needs a direct connection; hosted Postgres such as
    // Neon gives the app a pooled DATABASE_URL and a separate DIRECT_URL.
    url: process.env.DIRECT_URL ?? env("DATABASE_URL"),
  },
});
