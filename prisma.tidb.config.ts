import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.tidb", override: true });

export default defineConfig({
  schema: "prisma/schema.tidb.prisma",
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
