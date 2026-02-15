import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "./schema";

// Note: dotenv removed - Vercel/Railway provide env vars natively
// For local dev, use `bun --env-file=.env` or set DATABASE_URL manually

// Lazy load the database connection to prevent build errors when DATABASE_URL is missing
// Lazy load the database connection to prevent build errors when DATABASE_URL is missing
const getDb = () => {
    if (!process.env.DATABASE_URL) {
        // Fallback: Try loading .env from project root manually in dev
        try {
            const fs = require('fs');
            const path = require('path');
            // Try going up levels to find .env (packages/database/src -> packages/database -> packages -> root)
            const envPath = path.resolve(__dirname, '../../../.env');

            if (fs.existsSync(envPath)) {
                console.log("[DB] Loading .env from:", envPath);
                const envContent = fs.readFileSync(envPath, 'utf-8');
                envContent.split('\n').forEach((line: string) => {
                    const parts = line.split('=');
                    if (parts.length >= 2 && !line.startsWith('#')) {
                        const key = parts[0]!.trim();
                        // Basic value parsing, removing quotes if present
                        let value = parts.slice(1).join('=').trim();
                        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                            value = value.slice(1, -1);
                        }
                        if (key && value && !process.env[key]) {
                            process.env[key] = value;
                        }
                    }
                });
            } else {
                console.warn("[DB] .env not found at:", envPath);
            }
        } catch (e) {
            console.warn("[DB] Failed to load .env manually:", e);
        }
    }

    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not defined");
    }
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    return drizzle(pool, { schema });
};

type Database = ReturnType<typeof getDb>;

let dbInstance: Database | undefined;

export const db = new Proxy({} as Database, {
    get: (target, prop) => {
        if (!dbInstance) {
            dbInstance = getDb();
        }
        return dbInstance![prop as keyof Database];
    },
});

import { ExtractTablesWithRelations } from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";

export type TxOrDb =
    | Database
    | PgTransaction<any, typeof schema, ExtractTablesWithRelations<typeof schema>>;
