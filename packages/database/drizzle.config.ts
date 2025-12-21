import { config } from 'dotenv';
import { defineConfig } from "drizzle-kit";

config({ path: '../../.env' }); // Load from root

export default defineConfig({
    schema: "./src/schema.ts",
    out: "./drizzle",
    dialect: "postgresql" as const,
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
});
