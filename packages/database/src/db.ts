import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
import * as schema from "./schema";

config({ path: "../../.env" });

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
