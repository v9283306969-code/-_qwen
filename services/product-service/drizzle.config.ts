import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/schema.ts"],
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://dev:dev@localhost:5432/mlecp_dev",
  },
  verbose: true,
  strict: true,
});
