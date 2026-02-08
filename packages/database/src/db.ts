import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "./schema";

// Note: dotenv removed - Vercel/Railway provide env vars natively
// For local dev, use `bun --env-file=.env` or set DATABASE_URL manually

// Lazy load the database connection to prevent build errors when DATABASE_URL is missing
const getDb = () => {
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
        return dbInstance[prop as keyof Database];
    },
});

import { ExtractTablesWithRelations } from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";

export type TxOrDb =
    | Database
    | PgTransaction<any, typeof schema, ExtractTablesWithRelations<typeof schema>>;
