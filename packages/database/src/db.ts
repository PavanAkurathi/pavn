import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig, Pool } from "@neondatabase/serverless";
import * as schema from "./schema";
import WebSocket from "ws";

// Note: dotenv removed - Vercel/Railway provide env vars natively
// For local dev, use `bun --env-file=.env` or set DATABASE_URL manually

// Neon uses WebSockets for the Pool/transaction client. Bun provides this natively,
// but Vercel's Node runtime needs an explicit constructor.
if (typeof process !== "undefined" && process.release?.name === "node") {
    neonConfig.webSocketConstructor = WebSocket;
}

const getDb = () => {
    if (!process.env.DATABASE_URL) {
        throw new Error(
            "DATABASE_URL is not defined. " +
            "For local dev, run with: bun --env-file=.env"
        );
    }
    const PoolCtor = Pool as unknown as new (config: { connectionString: string }) => InstanceType<typeof Pool>;
    const pool = new PoolCtor({ connectionString: process.env.DATABASE_URL });
    return drizzle(pool, { schema });
};

type Database = ReturnType<typeof getDb>;

let dbInstance: Database | undefined;

export const db = new Proxy({} as Database, {
    get: (target, prop) => {
        if (!dbInstance) {
            dbInstance = getDb();
        }
        const value = dbInstance![prop as keyof Database];
        return typeof value === "function" ? value.bind(dbInstance) : value;
    },
});

import { ExtractTablesWithRelations } from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";

export type TxOrDb =
    | Database
    | PgTransaction<any, typeof schema, ExtractTablesWithRelations<typeof schema>>;
